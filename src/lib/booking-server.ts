import "server-only";
import { and, desc, eq, inArray, lt, gt, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { bookingRef, newId, nowIso } from "./ids";
import { nightsBetween } from "./i18n";
import { addDays } from "./dates";

export type BookingWithHotel = schema.Booking & { hotel: schema.Hotel; room: schema.Room | null };

/** Number of this room type still free for every night in [checkIn, checkOut). */
export function roomsAvailable(room: schema.Room, checkIn: string, checkOut: string, excludeBookingId?: string): number {
  // Overlap: existing.checkIn < new.checkOut AND existing.checkOut > new.checkIn
  const overlapping = db.select({ checkIn: schema.bookings.checkIn, checkOut: schema.bookings.checkOut }).from(schema.bookings).where(and(
    eq(schema.bookings.roomId, room.id),
    inArray(schema.bookings.status, ["confirmed", "pending_payment"]),
    lt(schema.bookings.checkIn, checkOut),
    gt(schema.bookings.checkOut, checkIn),
    excludeBookingId ? sql`${schema.bookings.id} <> ${excludeBookingId}` : undefined,
  )).all();
  if (overlapping.length === 0) return room.quantity;
  // Units free = quantity minus the busiest night of the requested stay.
  let peak = 0;
  for (let night = checkIn; night < checkOut; night = addDays(night, 1)) {
    const busy = overlapping.filter((b) => b.checkIn <= night && b.checkOut > night).length;
    if (busy > peak) peak = busy;
  }
  return Math.max(0, room.quantity - peak);
}

/** Units left per active room of a hotel for the given stay. */
export function availabilityForHotel(hotelId: string, checkIn: string, checkOut: string): Map<string, number> {
  const rooms = db.select().from(schema.rooms).where(and(eq(schema.rooms.hotelId, hotelId), eq(schema.rooms.active, true))).all();
  return new Map(rooms.map((r) => [r.id, roomsAvailable(r, checkIn, checkOut)]));
}

export type BookingErrorCode = "notFound" | "invalidDates" | "tooManyGuests" | "notAvailable";
export class BookingError extends Error {
  constructor(public code: BookingErrorCode) { super(code); }
}

export type NewBooking = {
  hotelId: string; roomId: string; userId: string | null; checkIn: string; checkOut: string; guests: number;
  firstName: string; lastName: string; email: string; phone: string; requests: string; locale: string;
  paymentMode: "stripe" | "demo";
};

export function createBooking(input: NewBooking): schema.Booking {
  // Availability check + insert run atomically so two simultaneous requests can't both take the last room.
  return db.transaction(() => createBookingTx(input));
}

function createBookingTx(input: NewBooking): schema.Booking {
  const room = db.select().from(schema.rooms).where(eq(schema.rooms.id, input.roomId)).get();
  if (!room || room.hotelId !== input.hotelId || !room.active) throw new BookingError("notFound");
  const nights = nightsBetween(input.checkIn, input.checkOut);
  if (nights < 1) throw new BookingError("invalidDates");
  if (room.sleeps < input.guests) throw new BookingError("tooManyGuests");
  if (roomsAvailable(room, input.checkIn, input.checkOut) < 1) throw new BookingError("notAvailable");
  const id = newId("b_");
  const ref = bookingRef();
  db.insert(schema.bookings).values({
    id, ref, hotelId: input.hotelId, roomId: input.roomId, userId: input.userId,
    checkIn: input.checkIn, checkOut: input.checkOut, guests: input.guests, nights, total: room.pricePerNight * nights,
    firstName: input.firstName, lastName: input.lastName, email: input.email.toLowerCase(), phone: input.phone, requests: input.requests,
    locale: input.locale, status: input.paymentMode === "demo" ? "confirmed" : "pending_payment", paymentMode: input.paymentMode,
    paidAt: input.paymentMode === "demo" ? nowIso() : null,
  }).run();
  return db.select().from(schema.bookings).where(eq(schema.bookings.id, id)).get()!;
}

/** Returns true only when the booking actually moved from pending_payment to confirmed. */
export function markBookingPaid(bookingId: string, stripeSessionId: string, paymentIntentId: string | null): boolean {
  const res = db.update(schema.bookings)
    .set({ status: "confirmed", paidAt: nowIso(), stripeSessionId, stripePaymentIntentId: paymentIntentId })
    .where(and(eq(schema.bookings.id, bookingId), eq(schema.bookings.status, "pending_payment")))
    .run();
  return res.changes > 0;
}

/** Cancels a booking that is still awaiting payment (no-op otherwise). */
export function cancelPendingBooking(bookingId: string): boolean {
  const res = db.update(schema.bookings).set({ status: "cancelled", cancelledAt: nowIso() })
    .where(and(eq(schema.bookings.id, bookingId), eq(schema.bookings.status, "pending_payment"))).run();
  return res.changes > 0;
}

export function getBookingByRef(ref: string): BookingWithHotel | undefined {
  const row = db.select({ b: schema.bookings, h: schema.hotels, r: schema.rooms })
    .from(schema.bookings)
    .innerJoin(schema.hotels, eq(schema.bookings.hotelId, schema.hotels.id))
    .leftJoin(schema.rooms, eq(schema.bookings.roomId, schema.rooms.id))
    .where(eq(schema.bookings.ref, ref.trim().toUpperCase())).get();
  return row ? { ...row.b, hotel: row.h, room: row.r } : undefined;
}

export function getBookingById(id: string): BookingWithHotel | undefined {
  const row = db.select({ b: schema.bookings, h: schema.hotels, r: schema.rooms })
    .from(schema.bookings)
    .innerJoin(schema.hotels, eq(schema.bookings.hotelId, schema.hotels.id))
    .leftJoin(schema.rooms, eq(schema.bookings.roomId, schema.rooms.id))
    .where(eq(schema.bookings.id, id)).get();
  return row ? { ...row.b, hotel: row.h, room: row.r } : undefined;
}

/** Bookings visible to a signed-in guest: made while signed in, or under their verified email. */
export function bookingsForGuest(userId: string, email: string): BookingWithHotel[] {
  return db.select({ b: schema.bookings, h: schema.hotels, r: schema.rooms })
    .from(schema.bookings)
    .innerJoin(schema.hotels, eq(schema.bookings.hotelId, schema.hotels.id))
    .leftJoin(schema.rooms, eq(schema.bookings.roomId, schema.rooms.id))
    .where(or(eq(schema.bookings.userId, userId), eq(schema.bookings.email, email.toLowerCase())))
    .orderBy(desc(schema.bookings.checkIn)).all()
    .map((row) => ({ ...row.b, hotel: row.h, room: row.r }));
}

export function bookingsForHotels(hotelIds: string[], limit = 200): BookingWithHotel[] {
  if (hotelIds.length === 0) return [];
  return db.select({ b: schema.bookings, h: schema.hotels, r: schema.rooms })
    .from(schema.bookings)
    .innerJoin(schema.hotels, eq(schema.bookings.hotelId, schema.hotels.id))
    .leftJoin(schema.rooms, eq(schema.bookings.roomId, schema.rooms.id))
    .where(inArray(schema.bookings.hotelId, hotelIds))
    .orderBy(desc(schema.bookings.createdAt)).limit(limit).all()
    .map((row) => ({ ...row.b, hotel: row.h, room: row.r }));
}

export function allBookings(limit = 300): BookingWithHotel[] {
  return db.select({ b: schema.bookings, h: schema.hotels, r: schema.rooms })
    .from(schema.bookings)
    .innerJoin(schema.hotels, eq(schema.bookings.hotelId, schema.hotels.id))
    .leftJoin(schema.rooms, eq(schema.bookings.roomId, schema.rooms.id))
    .orderBy(desc(schema.bookings.createdAt)).limit(limit).all()
    .map((row) => ({ ...row.b, hotel: row.h, room: row.r }));
}

/** Expire unpaid Stripe bookings older than 2 hours so the room frees up. */
export function expireStaleBookings() {
  const cutoff = new Date(Date.now() - 2 * 3_600_000).toISOString();
  db.update(schema.bookings).set({ status: "cancelled", cancelledAt: nowIso() })
    .where(and(eq(schema.bookings.status, "pending_payment"), lt(schema.bookings.createdAt, cutoff))).run();
}
