"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser, clientIp, rateLimit } from "@/lib/auth";
import { createBooking, expireStaleBookings } from "@/lib/booking-server";
import { onBookingConfirmed } from "@/lib/payments";
import { rememberBookingRef } from "@/lib/booking-access";
import { APP_URL } from "@/lib/email";
import { getDictionary, isLocale, nightsBetween, type Locale } from "@/lib/i18n";
import { getLiveHotel } from "@/lib/hotels";
import { getStripe } from "@/lib/stripe";
import { track } from "@/lib/analytics";
import { todayIso } from "@/lib/dates";
import type { ActionState } from "./auth";

const schemaIn = z.object({
  locale: z.string(),
  hotel: z.string().min(1),
  room: z.string().min(1),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.coerce.number().int().min(1).max(8),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z.string().trim().min(5).max(40),
  requests: z.string().trim().max(1000).default(""),
  agree: z.literal("on"),
});

export async function startBooking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale: Locale = isLocale(String(formData.get("locale"))) ? (formData.get("locale") as Locale) : "en";
  const d = getDictionary(locale);
  const parsed = schemaIn.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const f = parsed.error.issues[0]?.path[0];
    if (f === "email") return { error: d.book.invalidEmail };
    if (f === "agree") return { error: d.book.mustAgree };
    return { error: d.book.required };
  }
  const v = parsed.data;
  const ip = await clientIp();
  if (!rateLimit(`book:${ip}`, 20, 10 * 60_000)) return { error: d.auth.rateLimited };

  const hotel = getLiveHotel(v.hotel);
  const room = hotel?.rooms.find((r) => r.id === v.room);
  if (!hotel || !room) return { error: d.common.error };
  if (nightsBetween(v.checkIn, v.checkOut) < 1 || v.checkIn < todayIso()) return { error: d.common.error };

  expireStaleBookings();
  const user = await getCurrentUser();
  const stripe = getStripe();
  // A signed-in guest always books under their verified email.
  const email = user?.role === "guest" ? user.email : v.email;
  let booking;
  try {
    booking = createBooking({
      hotelId: hotel.dbId, roomId: room.id, userId: user?.id ?? null,
      checkIn: v.checkIn, checkOut: v.checkOut, guests: v.guests,
      firstName: v.firstName, lastName: v.lastName, email, phone: v.phone, requests: v.requests,
      locale, paymentMode: stripe ? "stripe" : "demo",
    });
  } catch (e) {
    return { error: (e as Error).message };
  }
  track("booking_started", { locale, meta: { hotel: hotel.id, total: booking.total } });
  await rememberBookingRef(booking.ref);

  if (!stripe) {
    await onBookingConfirmed(booking.id);
    redirect(`/${locale}/confirmation?ref=${booking.ref}`);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: email,
    locale: locale === "ja" ? "ja" : "en",
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "jpy",
        unit_amount: booking.total,
        product_data: {
          name: `${hotel.name[locale]} – ${room.name[locale]}`,
          description: `${v.checkIn} → ${v.checkOut}, ${booking.nights} ${locale === "ja" ? "泊" : "night(s)"}, ${v.guests} ${locale === "ja" ? "名" : "guest(s)"}`,
        },
      },
    }],
    metadata: { bookingId: booking.id, ref: booking.ref },
    success_url: `${APP_URL}/${locale}/confirmation?ref=${booking.ref}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/${locale}/hotels/${hotel.id}?checkIn=${v.checkIn}&checkOut=${v.checkOut}&guests=${v.guests}`,
    expires_at: Math.floor(Date.now() / 1000) + 35 * 60, // Stripe minimum is 30 min, measured server-side
  });
  db.update(schema.bookings).set({ stripeSessionId: session.id }).where(eq(schema.bookings.id, booking.id)).run();
  redirect(session.url!);
}

