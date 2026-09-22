import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { BookingError, cancelPendingBooking, createBooking, expireStaleBookings } from "./booking-server";
import { APP_URL } from "./email";
import { getLiveHotel } from "./hotels";
import { nightsBetween, type Locale } from "./i18n";
import { newToken, sha256 } from "./ids";
import { onBookingConfirmed } from "./payments";
import { demoPaymentsAllowed, getStripe } from "./stripe";
import { track } from "./analytics";
import { todayIso } from "./dates";

export type GuestBookingInput = {
  locale: Locale;
  hotelSlug: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  requests: string;
  userId: string | null;
  via: "site" | "api";
};

export type BookingFailure = "notFound" | "invalidDates" | "tooManyGuests" | "notAvailable" | "stripe" | "stripe_not_configured";

export async function startGuestBooking(input: GuestBookingInput): Promise<
  | { ok: true; booking: schema.Booking; paymentUrl: string | null; confirmationUrl: string; viewToken: string }
  | { ok: false; error: BookingFailure }
> {
  const hotel = getLiveHotel(input.hotelSlug);
  const room = hotel?.rooms.find((r) => r.id === input.roomId);
  if (!hotel || !room) return { ok: false, error: "notFound" };
  if (nightsBetween(input.checkIn, input.checkOut) < 1 || input.checkIn < todayIso()) return { ok: false, error: "invalidDates" };

  expireStaleBookings();
  const stripe = getStripe();
  // Production never confirms a stay without Stripe Checkout. A demo server confirms it so an assistant can finish the booking.
  if (!stripe && !demoPaymentsAllowed()) return { ok: false, error: "stripe_not_configured" };
  const viewToken = newToken();
  let booking: schema.Booking;
  try {
    booking = createBooking({
      hotelId: hotel.dbId, roomId: room.id, userId: input.userId,
      checkIn: input.checkIn, checkOut: input.checkOut, guests: input.guests,
      firstName: input.firstName, lastName: input.lastName, email: input.email, phone: input.phone, requests: input.requests,
      locale: input.locale, paymentMode: stripe ? "stripe" : "demo",
    });
  } catch (e) {
    if (e instanceof BookingError) return { ok: false, error: e.code };
    throw e;
  }
  db.update(schema.bookings).set({ viewTokenHash: sha256(viewToken) }).where(eq(schema.bookings.id, booking.id)).run();
  track("booking_started", { locale: input.locale, meta: { hotel: hotel.id, total: booking.total, via: input.via } });

  const confirmationUrl = `${APP_URL}/${input.locale}/confirmation?ref=${encodeURIComponent(booking.ref)}&token=${encodeURIComponent(viewToken)}`;
  if (!stripe) {
    await onBookingConfirmed(booking.id, viewToken);
    return { ok: true, booking, paymentUrl: null, confirmationUrl, viewToken };
  }

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: input.email,
      locale: input.locale === "ja" ? "ja" : "en",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "jpy",
          unit_amount: booking.total,
          product_data: {
            name: `${hotel.name[input.locale]} – ${room.name[input.locale]}`,
            description: `${input.checkIn} → ${input.checkOut}, ${booking.nights} ${input.locale === "ja" ? "泊" : "night(s)"}, ${input.guests} ${input.locale === "ja" ? "名" : "guest(s)"}`,
          },
        },
      }],
      metadata: { bookingId: booking.id, ref: booking.ref },
      success_url: `${confirmationUrl}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/${input.locale}/hotels/${hotel.id}?checkIn=${input.checkIn}&checkOut=${input.checkOut}&guests=${input.guests}`,
      expires_at: Math.floor(Date.now() / 1000) + 35 * 60,
    });
  } catch (e) {
    cancelPendingBooking(booking.id);
    console.error("Stripe checkout session failed", e);
    return { ok: false, error: "stripe" };
  }
  if (!session.url) {
    cancelPendingBooking(booking.id);
    return { ok: false, error: "stripe" };
  }
  db.update(schema.bookings).set({ stripeSessionId: session.id }).where(eq(schema.bookings.id, booking.id)).run();
  return { ok: true, booking, paymentUrl: session.url, confirmationUrl, viewToken };
}
