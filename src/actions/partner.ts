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
import { newId, nowIso } from "@/lib/ids";
import { demoPaymentsAllowed, getStripe, PARTNER_ANNUAL_FEE } from "@/lib/stripe";
import { applyFeePayment, subscriptionPeriodEnd } from "@/lib/payments";
import { isLive } from "@/lib/hotels";
import { keepRegisteredFields } from "@/lib/listing-lock";
import { coerceListingBody, englishFromBody, listingBodySchema, listingFromBody } from "@/lib/api-schemas";
import { isUploadUrl, MAX_PHOTOS_PER_LISTING } from "@/lib/uploads";
import { addListingForPartner, ListingError, registerPartnerWithListing, savePartnerListing, type NormalizedListing } from "@/lib/listing-write";
import { MapsLinkError, resolveMapsLink } from "@/lib/maps-link";
import type { ActionState } from "./auth";

function loc(v: unknown): Locale { return typeof v === "string" && isLocale(v) ? v : "ja"; }

/**
 * Turns the flat FormData of the listing form (rooms are indexed: rooms[0][nameJa]) into the same
 * object shape the API accepts, so the form and the API share one validator (listingBodySchema).
 */
function listingFromForm(formData: FormData) {
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
    // Checkboxes are absent when unchecked, so decide the booleans here rather than let the API default them.
    return { ...r, breakfast: r.breakfast === "on", refundable: r.refundable === "on", sizeSqm: r.sizeSqm === "" ? undefined : r.sizeSqm };
  });
  obj.images = parseImages(String(obj.images ?? ""));
  for (const key of ["latitude", "longitude"] as const) {
    const n = Number(obj[key]);
    if (obj[key] === "" || obj[key] == null || !Number.isFinite(n)) delete obj[key]; else obj[key] = n;
  }
  for (const key of ["retranslate", "hotelId", "website", "account"]) delete obj[key];
  const parsed = listingBodySchema.safeParse(coerceListingBody(obj));
  if (!parsed.success) return parsed;
  // The website form asks for a phone and licence; the API lets an assistant add them later.
  const strict = z.object({ phone: z.string().min(5), licenseNumber: z.string().min(2) }).safeParse(parsed.data);
  if (!strict.success) return strict;
  return parsed;
}

function parseImages(raw: string): string[] {
  return raw.split(/\r?\n/).map((s) => s.trim()).filter((s) => /^https:\/\/\S+$/.test(s) || isUploadUrl(s)).slice(0, MAX_PHOTOS_PER_LISTING);
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
  const listing: NormalizedListing = {
    nameJa: short.data.nameJa,
    nameEn: short.data.nameJa,
    type: short.data.type,
    city: short.data.city,
    address: short.data.address,
    phone: "",
    licenseNumber: "",
    stationJa: "",
    areaJa: "",
    descriptionJa: "",
    accessJa: "",
    checkInTime: "15:00",
    checkOutTime: "11:00",
    amenities: [],
    images: [],
    latitude: pin.latitude,
    longitude: pin.longitude,
    rooms: [],
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

const propertySchema = z.object({
  nameJa: z.string().trim().min(1).max(120),
  type: z.enum(["hotel", "ryokan", "business", "hostel"]),
  city: z.string().refine((c) => cities.some((x) => x.id === c)),
  address: z.string().trim().min(3).max(300),
  mapsUrl: z.string().trim().min(8).max(2000),
});

/** A signed-in partner registers another (or a first) property. Same fields as sign-up, minus the account. */
export async function addProperty(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = loc(formData.get("locale"));
  const d = getDictionary(locale);
  const user = await getCurrentUser();
  if (!user || user.role !== "partner") redirect(`/${locale}/partner/login`);
  if (String(formData.get("website") ?? "") !== "") return { ok: true, message: d.partner.propertyAdded }; // bot: pretend success
  if (formData.get("agree") !== "on") return { error: d.book.mustAgree };
  const short = propertySchema.safeParse(Object.fromEntries(formData));
  if (!short.success) return { error: d.book.required };
  let pin: { latitude: number | null; longitude: number | null };
  try {
    pin = await resolveMapsLink(short.data.mapsUrl);
  } catch (e) {
    if (e instanceof MapsLinkError) return { error: d.partner.mapsInvalid };
    throw e;
  }
  await addListingForPartner(user.id, {
    nameJa: short.data.nameJa,
    nameEn: short.data.nameJa,
    type: short.data.type,
    city: short.data.city,
    address: short.data.address,
    phone: "",
    licenseNumber: "",
    stationJa: "",
    areaJa: "",
    descriptionJa: "",
    accessJa: "",
    checkInTime: "15:00",
    checkOutTime: "11:00",
    amenities: [],
    images: [],
    latitude: pin.latitude,
    longitude: pin.longitude,
    rooms: [],
  });
  revalidatePath(`/${locale}/partner`);
  redirect(`/${locale}/partner`);
}

const changeRequestSchema = z.object({
  hotelId: z.string().min(1),
  field: z.enum(["name", "type", "city", "address", "pin", "other"]),
  requested: z.string().trim().min(1).max(500),
  reason: z.string().trim().max(1000).default(""),
});

/** A partner asks Yado to change a registered detail. Lands in the admin queue; Yado applies it. */
export async function requestChange(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = loc(formData.get("locale"));
  const d = getDictionary(locale);
  const user = await getCurrentUser();
  if (!user || user.role !== "partner") redirect(`/${locale}/partner/login`);
  if (!rateLimit(`change-request:${user.id}`, 10, 60 * 60_000)) return { error: d.auth.rateLimited };
  const parsed = changeRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: d.book.required };
  const hotel = ownedHotel(user.id, parsed.data.hotelId);
  if (!hotel) return { error: d.book.required };
  const open = db.select({ id: schema.changeRequests.id }).from(schema.changeRequests)
    .where(and(eq(schema.changeRequests.hotelId, hotel.id), eq(schema.changeRequests.status, "open"))).all();
  if (open.length >= 5) return { error: d.partner.changeTooMany };
  const { field, requested, reason } = parsed.data;
  db.insert(schema.changeRequests).values({ id: newId("cr_"), hotelId: hotel.id, userId: user.id, field, requested, reason }).run();
  audit(user.id, "partner.change_requested", hotel.id, parsed.data.field);
  const admins = db.select().from(schema.users).where(eq(schema.users.role, "head_admin")).all();
  for (const a of admins) {
    await sendEmail(a.email, `[Yado] Change request: ${hotel.nameJa} (${parsed.data.field})`,
      `${user.name} <${user.email}> asks to change ${parsed.data.field} of "${hotel.nameJa}" to:\n\n${parsed.data.requested}\n\n${parsed.data.reason ? `Reason: ${parsed.data.reason}\n\n` : ""}Review: ${APP_URL}/admin/changes`);
  }
  revalidatePath(`/${locale}/partner/property`);
  return { ok: true, message: d.partner.changeSent };
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

  const base = listingFromForm(formData);
  if (!base.success) return { error: `${d.book.required}: ${base.error.issues[0].path.join(".")}` };
  const retranslate = formData.get("retranslate") === "1";
  // Partners keep what they registered; only Yado changes name, type, city, address, and pin.
  const fromForm = listingFromBody(base.data);
  const normalized = user.role === "partner" ? keepRegisteredFields(hotel, fromForm).listing : fromForm;
  const english = user.role === "partner" ? { ...englishFromBody(base.data), nameEn: hotel.nameEn } : englishFromBody(base.data);
  await savePartnerListing(hotel, normalized, english, { retranslate, fillEnglish: false }, user.id);
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
    if (!demoPaymentsAllowed()) redirect(`/${locale}/partner?error=payments`);
    // Local demo: one year per click, with no card.
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
  if (!session.url) redirect(`/${locale}/partner?error=payments`);
  redirect(session.url);
}

