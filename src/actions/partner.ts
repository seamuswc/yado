"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit, clientIp, consumeToken, createSession, findUserByEmail, getCurrentUser, issueToken, rateLimit, requireRole } from "@/lib/auth";
import { APP_URL, sendEmail, templates } from "@/lib/email";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n";
import { cities } from "@/lib/hotels";
import { nowIso } from "@/lib/ids";
import { getStripe, PARTNER_ANNUAL_FEE } from "@/lib/stripe";
import { applyFeePayment, subscriptionPeriodEnd } from "@/lib/payments";
import { isLive } from "@/lib/hotels";
import { draftProperty } from "@/lib/draft-listing";
import { ListingError, registerPartnerWithListing, savePartnerListing, type NormalizedListing } from "@/lib/listing-write";
import { MapsLinkError, resolveMapsLink } from "@/lib/maps-link";
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

function normalizedFromForm(L: z.infer<typeof listingSchema>): NormalizedListing {
  return {
    ...L,
    images: parseImages(L.images),
    latitude: L.latitude ?? null,
    longitude: L.longitude ?? null,
    rooms: L.rooms.map((r) => ({ ...r, sizeSqm: r.sizeSqm ?? null })),
  };
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
  const short = z.object({
    nameJa: z.string().trim().min(1).max(120),
    type: z.enum(["hotel", "ryokan", "business", "hostel"]),
    city: z.string().refine((c) => cities.some((x) => x.id === c)),
    address: z.string().trim().min(3).max(300),
    mapsUrl: z.string().trim().min(8).max(2000),
  }).safeParse(Object.fromEntries(formData));
  if (!short.success) return { error: d.book.required };
  if (findUserByEmail(acct.data.email)) return { error: d.partner.alreadyRegistered };
  let pin: { latitude: number | null; longitude: number | null };
  try {
    pin = await resolveMapsLink(short.data.mapsUrl);
  } catch (e) {
    if (e instanceof MapsLinkError) return { error: d.partner.mapsInvalid };
    throw e;
  }
  const basics = { name: short.data.nameJa, type: short.data.type, city: short.data.city, address: short.data.address };
  const drafted = await draftProperty(basics);
  const listing: NormalizedListing = {
    nameJa: short.data.nameJa,
    type: short.data.type,
    city: short.data.city,
    address: short.data.address,
    phone: "",
    licenseNumber: "",
    stationJa: drafted.stationJa,
    areaJa: drafted.areaJa,
    descriptionJa: drafted.descriptionJa,
    accessJa: drafted.accessJa,
    checkInTime: drafted.checkInTime,
    checkOutTime: drafted.checkOutTime,
    amenities: drafted.amenities,
    images: [],
    latitude: pin.latitude,
    longitude: pin.longitude,
    nameEn: drafted.nameEn,
    areaEn: drafted.areaEn,
    descriptionEn: drafted.descriptionEn,
    accessEn: drafted.accessEn,
    stationEn: drafted.stationEn,
    rooms: drafted.rooms,
  };
  let created;
  try {
    created = await registerPartnerWithListing({
      contactName: acct.data.contactName,
      email: acct.data.email,
      password: acct.data.password,
      locale,
      listing,
    });
  } catch (e) {
    if (e instanceof ListingError) return { error: d.partner.alreadyRegistered };
    throw e;
  }
  const user = created.user;

  const token = issueToken(user.id, "verify_email", 24);
  const t = templates.verifyPartner(locale, `${APP_URL}/api/auth/verify?token=${token}&locale=${locale}`);
  await sendEmail(user.email, t.subject, t.body);
  return { ok: true, message: d.partner.registeredBody.replace("{email}", user.email) };
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
  const locale = loc(formData.get("locale"));
  const d = getDictionary(locale);
  const user = await getCurrentUser();
  if (!user || (user.role !== "partner" && user.role !== "head_admin")) return { error: d.auth.signIn };
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
  const retranslate = formData.get("retranslate") === "1";
  await savePartnerListing(hotel, normalizedFromForm(base.data), extra, { retranslate, fillEnglish: false }, user.id);
  revalidatePath(`/${locale}/partner`);
  return { ok: true, message: d.partner.saved };
}

// ---------- annual fee ----------

export async function startFeeCheckout(formData: FormData): Promise<void> {
  const user = await requireRole("partner");
  const locale = loc(formData.get("locale"));
  const hotel = ownedHotel(user.id, String(formData.get("hotelId") ?? ""));
  if (!hotel || hotel.status !== "approved" || isLive(hotel)) redirect(`/${locale}/partner`);

  const stripe = getStripe();
  if (stripe && hotel.stripeSubscriptionId) {
    // An existing subscription may simply have renewed while a webhook was missed: sync from Stripe instead of billing again.
    const end = await subscriptionPeriodEnd(hotel.stripeSubscriptionId);
    if (end && end * 1000 > Date.now()) {
      applyFeePayment(hotel.id, `sync:${hotel.stripeSubscriptionId}:${end}`, hotel.stripeSubscriptionId, end);
      redirect(`/${locale}/partner?paid=1`);
    }
  }
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

