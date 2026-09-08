import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { newId } from "./ids";
import { todayIso } from "./dates";

/** Denormalise average rating and count onto the hotel row. */
export function recomputeRating(hotelId: string) {
  // Seeded reviews exist in both locales for the same stay; count distinct (author, stayMonth) so they aren't double-counted.
  const row = db.select({
    avg: sql<number>`coalesce(avg(rating),0)`,
    n: sql<number>`count(distinct author_name || '|' || stay_month || '|' || coalesce(booking_id,''))`,
  }).from(schema.reviews).where(and(eq(schema.reviews.hotelId, hotelId), eq(schema.reviews.status, "visible"))).get();
  db.update(schema.hotels).set({ rating: Math.round((row?.avg ?? 0) * 10) / 10, reviewCount: row?.n ?? 0 }).where(eq(schema.hotels.id, hotelId)).run();
}

export function reviewsForHotel(hotelId: string, locale: string, limit = 20): schema.Review[] {
  // Prefer reviews written in the viewer's language, then the rest.
  const rows = db.select().from(schema.reviews)
    .where(and(eq(schema.reviews.hotelId, hotelId), eq(schema.reviews.status, "visible")))
    .orderBy(sql`case when locale = ${locale} then 0 else 1 end`, desc(schema.reviews.createdAt))
    .all();
  // Seeded demo reviews exist as an EN + JA pair for the same stay; show only one of the pair.
  const seen = new Set<string>();
  const out: schema.Review[] = [];
  for (const r of rows) {
    const key = r.bookingId ?? `${r.authorName}|${r.stayMonth}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
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

export function addReview(input: { booking: schema.Booking; userId: string; authorName: string; rating: number; title: string; body: string; locale: string }) {
  db.insert(schema.reviews).values({
    id: newId("rv_"), hotelId: input.booking.hotelId, bookingId: input.booking.id, userId: input.userId,
    authorName: input.authorName, rating: input.rating, title: input.title, body: input.body, locale: input.locale,
    stayMonth: input.booking.checkIn.slice(0, 7),
  }).run();
  recomputeRating(input.booking.hotelId);
}
