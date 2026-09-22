import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { newId } from "./ids";
import { todayIso } from "./dates";
import type { Locale } from "./i18n";
import { hasJapanese, translateTexts } from "./translate";

/** Denormalise average rating and count onto the hotel row. */
export function recomputeRating(hotelId: string) {
  // Older seeds stored an EN + JA pair for the same stay; count distinct (author, stayMonth) so they aren't double-counted.
  const row = db.select({
    avg: sql<number>`coalesce(avg(rating),0)`,
    n: sql<number>`count(distinct author_name || '|' || stay_month || '|' || coalesce(booking_id,''))`,
  }).from(schema.reviews).where(and(eq(schema.reviews.hotelId, hotelId), eq(schema.reviews.status, "visible"))).get();
  db.update(schema.hotels).set({ rating: Math.round((row?.avg ?? 0) * 10) / 10, reviewCount: row?.n ?? 0 }).where(eq(schema.hotels.id, hotelId)).run();
}

export type PublicReview = {
  id: string;
  rating: number;
  title: string;
  body: string;
  authorName: string;
  stayMonth: string;
  translated: boolean;
};

/** Title and body in the viewer's language. Falls back to the original if that side is empty. */
export function reviewInLocale(r: schema.Review, locale: Locale): PublicReview {
  const title = locale === "ja" ? (r.titleJa || r.titleEn || r.title) : (r.titleEn || r.titleJa || r.title);
  const body = locale === "ja" ? (r.bodyJa || r.bodyEn || r.body) : (r.bodyEn || r.bodyJa || r.body);
  const usedOther = locale === "ja"
    ? !r.titleJa && !r.bodyJa && !!(r.titleEn || r.bodyEn)
    : !r.titleEn && !r.bodyEn && !!(r.titleJa || r.bodyJa);
  const hasBoth = !!(r.titleEn && r.titleJa) || !!(r.bodyEn && r.bodyJa);
  return {
    id: r.id, rating: r.rating, title, body, authorName: r.authorName, stayMonth: r.stayMonth,
    translated: hasBoth && r.locale !== locale && !usedOther,
  };
}

export function reviewsForHotel(hotelId: string, locale: Locale, limit = 20): PublicReview[] {
  const rows = db.select().from(schema.reviews)
    .where(and(eq(schema.reviews.hotelId, hotelId), eq(schema.reviews.status, "visible")))
    .orderBy(sql`case when locale = ${locale} then 0 else 1 end`, desc(schema.reviews.createdAt))
    .all();
  const seen = new Set<string>();
  const out: PublicReview[] = [];
  for (const r of rows) {
    const key = r.bookingId ?? `${r.authorName}|${r.stayMonth}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(reviewInLocale(r, locale));
    if (out.length >= limit) break;
  }
  return out;
}

/** Bookings by this guest that are confirmed, finished, and not yet reviewed. */
export function reviewableBookings(userId: string, email: string) {
  const today = todayIso();
  return db.select({ b: schema.bookings, h: schema.hotels })
    .from(schema.bookings)
    .innerJoin(schema.hotels, eq(schema.bookings.hotelId, schema.hotels.id))
    .leftJoin(schema.reviews, eq(schema.reviews.bookingId, schema.bookings.id))
    .where(and(
      sql`(${schema.bookings.userId} = ${userId} or ${schema.bookings.email} = ${email.toLowerCase()})`,
      eq(schema.bookings.status, "confirmed"),
      sql`${schema.bookings.checkOut} <= ${today}`,
      sql`${schema.reviews.id} is null`,
    )).all();
}

export function canReview(bookingId: string, userId: string, email: string): { ok: true; booking: schema.Booking } | { ok: false; reason: string } {
  const b = db.select().from(schema.bookings).where(eq(schema.bookings.id, bookingId)).get();
  if (!b) return { ok: false, reason: "not_found" };
  if (b.userId !== userId && b.email !== email.toLowerCase()) return { ok: false, reason: "not_yours" };
  if (b.status !== "confirmed") return { ok: false, reason: "not_confirmed" };
  if (b.checkOut > todayIso()) return { ok: false, reason: "stay_not_finished" };
  const existing = db.select({ id: schema.reviews.id }).from(schema.reviews).where(eq(schema.reviews.bookingId, bookingId)).get();
  if (existing) return { ok: false, reason: "already_reviewed" };
  return { ok: true, booking: b };
}

export async function addReview(input: { booking: schema.Booking; userId: string; authorName: string; rating: number; title: string; body: string; locale: string }) {
  const source: Locale = hasJapanese(input.title) || hasJapanese(input.body) ? "ja" : "en";
  const other: Locale = source === "ja" ? "en" : "ja";
  const translated = await translateTexts([input.title, input.body], other);
  const titleEn = source === "en" ? input.title : (translated?.[0] || input.title);
  const titleJa = source === "ja" ? input.title : (translated?.[0] || input.title);
  const bodyEn = source === "en" ? input.body : (translated?.[1] || input.body);
  const bodyJa = source === "ja" ? input.body : (translated?.[1] || input.body);
  db.insert(schema.reviews).values({
    id: newId("rv_"), hotelId: input.booking.hotelId, bookingId: input.booking.id, userId: input.userId,
    authorName: input.authorName, rating: input.rating, title: input.title, body: input.body,
    titleEn, titleJa, bodyEn, bodyJa, locale: input.locale,
    stayMonth: input.booking.checkIn.slice(0, 7),
  }).run();
  recomputeRating(input.booking.hotelId);
}

/** Translate a guest special request into both languages. */
export async function pairRequestText(raw: string): Promise<{ en: string; ja: string }> {
  const text = raw.trim();
  if (!text) return { en: "", ja: "" };
  const source: Locale = hasJapanese(text) ? "ja" : "en";
  const other: Locale = source === "ja" ? "en" : "ja";
  const translated = await translateTexts([text], other);
  const otherText = translated?.[0] || text;
  return source === "ja" ? { ja: text, en: otherText } : { en: text, ja: otherText };
}

export function requestInLocale(b: Pick<schema.Booking, "requests" | "requestsEn" | "requestsJa">, locale: Locale): string {
  if (locale === "ja") return b.requestsJa || b.requestsEn || b.requests;
  return b.requestsEn || b.requestsJa || b.requests;
}
