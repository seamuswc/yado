"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit, clientIp, consumeToken, createSession, createUser, findUserByEmail, issueToken, rateLimit, requireRole } from "@/lib/auth";
import { APP_URL, sendEmail, templates } from "@/lib/email";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n";
import { amenityKeys, cities } from "@/lib/hotels";
import { newId, nowIso, slugify } from "@/lib/ids";
import { getStripe, PARTNER_ANNUAL_FEE } from "@/lib/stripe";
import { applyFeePayment } from "@/lib/payments";
import { translateListing } from "@/lib/translate";
import type { ActionState } from "./auth";

function loc(v: unknown): Locale { return typeof v === "string" && isLocale(v) ? v : "ja"; }

const roomSchema = z.object({
  id: z.string().optional(),
  nameJa: z.string().trim().min(1).max(80),
  descriptionJa: z.string().trim().max(300).default(""),
  nameEn: z.string().trim().max(80).optional(),
  descriptionEn: z.string().trim().max(300).optional(),
  sleeps: z.coerce.number().int().min(1).max(12),
  sizeSqm: z.coerce.number().int().min(0).max(1000).optional(),
  pricePerNight: z.coerce.number().int().min(500).max(5_000_000),
  quantity: z.coerce.number().int().min(1).max(500),
  breakfast: z.coerce.boolean().default(false),
  refundable: z.coerce.boolean().default(true),
});

const listingSchema = z.object({
  nameJa: z.string().trim().min(1).max(120),
  type: z.enum(["hotel", "ryokan", "business", "hostel"]),
  city: z.string().refine((c) => cities.some((x) => x.id === c)),
  address: z.string().trim().min(3).max(300),
  phone: z.string().trim().min(5).max(40),
  licenseNumber: z.string().trim().min(2).max(80),
  stationJa: z.string().trim().max(80).default(""),
  areaJa: z.string().trim().max(120).default(""),
  descriptionJa: z.string().trim().min(10).max(3000),
  accessJa: z.string().trim().max(500).default(""),
  checkInTime: z.string().regex(/^\d{2}:\d{2}$/).default("15:00"),
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/).default("11:00"),
  amenities: z.array(z.string()).default([]),
  images: z.string().default(""),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  rooms: z.array(roomSchema).min(1).max(30),
});

/** Parses the flat FormData of the listing form (rooms are indexed: rooms[0][nameJa]). */
function parseListing(formData: FormData) {
  const obj: Record<string, unknown> = {};
  const rooms: Record<number, Record<string, unknown>> = {};
  for (const [k, v] of formData.entries()) {
    const m = k.match(/^rooms\[(\d+)\]\[(\w+)\]$/);
    if (m) { (rooms[Number(m[1])] ??= {})[m[2]] = v; continue; }
    if (k === "amenities") { obj.amenities = [...((obj.amenities as string[] | undefined) ?? []), String(v)]; continue; }
    obj[k] = v;
  }
  obj.rooms = Object.keys(rooms).sort((a, b) => Number(a) - Number(b)).map((i) => {
    const r = rooms[Number(i)];
    return { ...r, breakfast: r.breakfast === "on", refundable: r.refundable === "on", sizeSqm: r.sizeSqm === "" ? undefined : r.sizeSqm };
  });
  if (obj.latitude === "") delete obj.latitude;
  if (obj.longitude === "") delete obj.longitude;
  return listingSchema.safeParse(obj);
}

function parseImages(raw: string): string[] {
  return raw.split(/\r?\n/).map((s) => s.trim()).filter((s) => /^https:\/\/\S+$/.test(s)).slice(0, 12);
}

// ---------- registration ----------

const registerSchema = z.object({
  contactName: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(10).max(200),
  agree: z.literal("on"),
  website: z.string().max(0), // honeypot: must stay empty
});

export async function registerPartner(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = loc(formData.get("locale"));
  const d = getDictionary(locale);
  const ip = await clientIp();
  if (!rateLimit(`register:${ip}`, 5, 60 * 60_000)) return { error: d.auth.rateLimited };

  const acct = registerSchema.safeParse(Object.fromEntries(formData));
  if (!acct.success) {
    const f = acct.error.issues[0]?.path[0];
    if (f === "website") return { ok: true, message: d.partner.registeredBody.replace("{email}", String(formData.get("email") ?? "")) }; // bot: pretend success
    if (f === "email") return { error: d.book.invalidEmail };
    if (f === "password") return { error: `${d.partner.password}: ${d.partner.passwordHint}` };
    if (f === "agree") return { error: d.book.mustAgree };
    return { error: d.book.required };
  }
  const listing = parseListing(formData);
  if (!listing.success) {
    const issue = listing.error.issues[0];
    return { error: `${d.book.required}: ${issue.path.join(".")}` };
  }
  if (findUserByEmail(acct.data.email)) return { error: d.partner.alreadyRegistered };

  const user = createUser({ email: acct.data.email, name: acct.data.contactName, role: "partner", password: acct.data.password, locale });
  const L = listing.data;

  // Auto-translate Japanese → English for the public toggle.
  const tr = await translateListing({
    name: L.nameJa, area: L.areaJa, description: L.descriptionJa, access: L.accessJa,
    rooms: L.rooms.map((r) => ({ name: r.nameJa, description: r.descriptionJa })),
  });
  const stationEn = L.stationJa ? (tr.machine ? await translateShort(L.stationJa) : L.stationJa) : "";

  const hotelId = newId("h_");
  let slug = slugify(tr.en.name || L.nameJa);
  if (db.select({ id: schema.hotels.id }).from(schema.hotels).where(eq(schema.hotels.slug, slug)).get()) slug = `${slug}-${hotelId.slice(2, 8).toLowerCase()}`;
  db.insert(schema.hotels).values({
    id: hotelId, slug, ownerId: user.id,
    nameJa: L.nameJa, nameEn: tr.en.name, city: L.city, areaJa: L.areaJa, areaEn: tr.en.area, type: L.type,
    descriptionJa: L.descriptionJa, descriptionEn: tr.en.description, accessJa: L.accessJa, accessEn: tr.en.access,
    stationJa: L.stationJa, stationEn, latitude: L.latitude ?? null, longitude: L.longitude ?? null,
    amenities: L.amenities.filter((a) => (amenityKeys as string[]).includes(a)), images: parseImages(L.images),
    checkInTime: L.checkInTime, checkOutTime: L.checkOutTime,
    legalName: L.nameJa, address: L.address, phone: L.phone, licenseNumber: L.licenseNumber,
    translation: tr.machine ? "machine" : "pending", status: "pending",
  }).run();
  L.rooms.forEach((r, i) => {
    db.insert(schema.rooms).values({
      id: newId("r_"), hotelId, nameJa: r.nameJa, nameEn: tr.en.rooms[i]?.name ?? r.nameJa,
      descriptionJa: r.descriptionJa, descriptionEn: tr.en.rooms[i]?.description ?? r.descriptionJa,
      sleeps: r.sleeps, sizeSqm: r.sizeSqm ?? null, pricePerNight: r.pricePerNight, quantity: r.quantity,
      breakfast: r.breakfast, refundable: r.refundable, sortOrder: i,
    }).run();
  });

  const token = issueToken(user.id, "verify_email", 24);
  const t = templates.verifyPartner(locale, `${APP_URL}/api/auth/verify?token=${token}&locale=${locale}`);
  await sendEmail(user.email, t.subject, t.body);
  audit(user.id, "partner.registered", hotelId, tr.machine ? "translated" : `translation skipped: ${tr.error ?? ""}`);
  return { ok: true, message: d.partner.registeredBody.replace("{email}", user.email) };
}

async function translateShort(ja: string): Promise<string> {
  const r = await translateListing({ name: ja, area: "", description: "", access: "", rooms: [] });
  return r.en.name || ja;
}

export async function verifyPartnerEmail(token: string): Promise<boolean> {
  const userId = consumeToken(token, "verify_email")?.userId ?? null;
  if (!userId) return false;
  const u = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
  if (!u || u.disabledAt) return false;
  db.update(schema.users).set({ emailVerifiedAt: nowIso() }).where(eq(schema.users.id, userId)).run();
  await createSession(userId);
  audit(userId, "partner.email_verified");
  return true;
}

// ---------- listing management ----------

function ownedHotel(userId: string, hotelId: string) {
  return db.select().from(schema.hotels).where(and(eq(schema.hotels.id, hotelId), eq(schema.hotels.ownerId, userId))).get();
}

const editSchema = listingSchema.extend({
  nameEn: z.string().trim().max(120).default(""),
  areaEn: z.string().trim().max(120).default(""),
  descriptionEn: z.string().trim().max(3000).default(""),
  accessEn: z.string().trim().max(500).default(""),
  stationEn: z.string().trim().max(80).default(""),
});

export async function updateListing(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireRole("partner", "head_admin");
  const locale = loc(formData.get("locale"));
  const d = getDictionary(locale);
  const hotelId = String(formData.get("hotelId") ?? "");
  const hotel = user.role === "head_admin"
    ? db.select().from(schema.hotels).where(eq(schema.hotels.id, hotelId)).get()
    : ownedHotel(user.id, hotelId);
  if (!hotel) return { error: d.common.error };

  const base = parseListing(formData);
  if (!base.success) return { error: `${d.book.required}: ${base.error.issues[0].path.join(".")}` };
  const extraParsed = editSchema.pick({ nameEn: true, areaEn: true, descriptionEn: true, accessEn: true, stationEn: true }).safeParse(Object.fromEntries(formData));
  if (!extraParsed.success) return { error: `${d.book.required}: ${extraParsed.error.issues[0].path.join(".")}` };
  const extra = extraParsed.data;
  const L = base.data;
  const retranslate = formData.get("retranslate") === "1";

  let en = { name: extra.nameEn, area: extra.areaEn, description: extra.descriptionEn, access: extra.accessEn, station: extra.stationEn };
  let roomsEn = L.rooms.map((r) => ({ name: r.nameEn ?? "", description: r.descriptionEn ?? "" }));
  let translation: schema.Hotel["translation"] = hotel.translation === "pending" && !en.name ? "pending" : "manual";
  if (retranslate) {
    const tr = await translateListing({ name: L.nameJa, area: L.areaJa, description: L.descriptionJa, access: L.accessJa, rooms: L.rooms.map((r) => ({ name: r.nameJa, description: r.descriptionJa })) });
    en = { ...tr.en, station: L.stationJa ? await translateShort(L.stationJa) : "" };
    roomsEn = tr.en.rooms;
    translation = tr.machine ? "machine" : "pending";
  }

  // Edits to a live listing keep it live; edits to a rejected one put it back in the queue.
  const status = hotel.status === "rejected" ? "pending" : hotel.status;
  db.update(schema.hotels).set({
    nameJa: L.nameJa, nameEn: en.name || L.nameJa, type: L.type, city: L.city, areaJa: L.areaJa, areaEn: en.area,
    descriptionJa: L.descriptionJa, descriptionEn: en.description || L.descriptionJa, accessJa: L.accessJa, accessEn: en.access,
    stationJa: L.stationJa, stationEn: en.station, latitude: L.latitude ?? null, longitude: L.longitude ?? null,
    amenities: L.amenities.filter((a) => (amenityKeys as string[]).includes(a)), images: parseImages(L.images),
    checkInTime: L.checkInTime, checkOutTime: L.checkOutTime, address: L.address, phone: L.phone, licenseNumber: L.licenseNumber,
    translation, status,
  }).where(eq(schema.hotels.id, hotel.id)).run();

  // Rooms: update existing by id, insert new, deactivate removed (bookings reference them).
  const existing = db.select().from(schema.rooms).where(eq(schema.rooms.hotelId, hotel.id)).all();
  const keep = new Set<string>();
  L.rooms.forEach((r, i) => {
    const values = {
      nameJa: r.nameJa, nameEn: roomsEn[i]?.name || r.nameJa, descriptionJa: r.descriptionJa, descriptionEn: roomsEn[i]?.description || r.descriptionJa,
      sleeps: r.sleeps, sizeSqm: r.sizeSqm ?? null, pricePerNight: r.pricePerNight, quantity: r.quantity, breakfast: r.breakfast, refundable: r.refundable, sortOrder: i, active: true,
    };
    const ex = r.id ? existing.find((x) => x.id === r.id) : undefined;
    if (ex) { db.update(schema.rooms).set(values).where(eq(schema.rooms.id, ex.id)).run(); keep.add(ex.id); }
    else { const id = newId("r_"); db.insert(schema.rooms).values({ id, hotelId: hotel.id, ...values }).run(); keep.add(id); }
  });
  for (const ex of existing) if (!keep.has(ex.id)) db.update(schema.rooms).set({ active: false }).where(eq(schema.rooms.id, ex.id)).run();

  audit(user.id, "partner.listing_updated", hotel.id, retranslate ? "retranslated" : "");
  revalidatePath(`/${locale}/partner`);
  return { ok: true, message: d.partner.saved };
}

// ---------- annual fee ----------

export async function startFeeCheckout(formData: FormData): Promise<void> {
  const user = await requireRole("partner");
  const locale = loc(formData.get("locale"));
  const hotel = ownedHotel(user.id, String(formData.get("hotelId") ?? ""));
  if (!hotel || hotel.status !== "approved") redirect(`/${locale}/partner`);

  const stripe = getStripe();
  if (!stripe) {
    // Demo mode: simulate a successful annual payment (one year per click).
    applyFeePayment(hotel.id, `demo:${Date.now()}`, null);
    audit(user.id, "partner.fee_paid_demo", hotel.id);
    redirect(`/${locale}/partner?paid=1`);
  }

  let customerId = hotel.stripeCustomerId;
  if (!customerId) {
    const c = await stripe.customers.create({ email: user.email, name: hotel.legalName || hotel.nameJa, metadata: { hotelId: hotel.id } });
    customerId = c.id;
    db.update(schema.hotels).set({ stripeCustomerId: customerId }).where(eq(schema.hotels.id, hotel.id)).run();
  }
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    locale: locale === "ja" ? "ja" : "en",
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "jpy", unit_amount: PARTNER_ANNUAL_FEE, recurring: { interval: "year" },
        product_data: { name: locale === "ja" ? "Yado 年間パートナー掲載料" : "Yado annual partner listing fee" },
      },
    }],
    metadata: { hotelId: hotel.id, kind: "partner_fee" },
    subscription_data: { metadata: { hotelId: hotel.id, kind: "partner_fee" } },
    success_url: `${APP_URL}/${locale}/partner?paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/${locale}/partner`,
  });
  redirect(session.url!);
}

