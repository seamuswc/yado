import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "./auth";
import { getBookingById, markBookingPaid } from "./booking-server";
import { APP_URL, sendEmail, templates } from "./email";
import { formatDate, isLocale, type Locale } from "./i18n";
import { nowIso } from "./ids";
import Stripe from "stripe";
import { getStripe } from "./stripe";
import { track } from "./analytics";

// ---------- guest bookings ----------

/** Side effects for a booking that has just become confirmed: emails to guest and hotel, analytics. */
export async function onBookingConfirmed(bookingId: string): Promise<void> {
  const b = getBookingById(bookingId);
  if (!b || b.status !== "confirmed") return;
  const locale: Locale = isLocale(b.locale) ? b.locale : "en";
  const hotelName = locale === "ja" ? b.hotel.nameJa : b.hotel.nameEn;
  const url = `${APP_URL}/${locale}/confirmation?ref=${b.ref}`;
  const t = templates.bookingConfirmed(locale, b.ref, hotelName, formatDate(b.checkIn, locale), formatDate(b.checkOut, locale), url);
  await sendEmail(b.email, t.subject, t.body);
  const owner = b.hotel.ownerId ? db.select().from(schema.users).where(eq(schema.users.id, b.hotel.ownerId)).get() : null;
  if (owner) {
    const ownerLocale: Locale = isLocale(owner.locale) ? owner.locale : "ja";
    const h = templates.newBookingForHotel(ownerLocale, b.ref, b.hotel.nameJa, `${b.lastName} ${b.firstName}`, b.checkIn, b.checkOut);
    await sendEmail(owner.email, h.subject, h.body);
  }
  track("booking_confirmed", { locale, meta: { hotel: b.hotel.slug, total: b.total, mode: b.paymentMode } });
}

/** Marks a booking paid exactly once and runs the side effects only on the real transition. */
export async function settleBookingPayment(bookingId: string, sessionId: string, paymentIntentId: string | null): Promise<boolean> {
  const changed = markBookingPaid(bookingId, sessionId, paymentIntentId);
  if (changed) await onBookingConfirmed(bookingId);
  return changed;
}

/** Fallback when the webhook hasn't arrived: verify the Checkout session directly with Stripe. */
export async function reconcileStripeSession(bookingId: string, sessionId: string): Promise<void> {
  const stripe = getStripe();
  if (!stripe) return;
  const b = getBookingById(bookingId);
  if (!b || b.status !== "pending_payment" || b.stripeSessionId !== sessionId) return;
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status === "paid" && session.metadata?.bookingId === bookingId) {
    const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
    await settleBookingPayment(bookingId, sessionId, pi);
  }
}

/** A payment arrived for a booking that is no longer payable (e.g. admin cancelled it): refund it. */
export async function refundOrphanPayment(paymentIntentId: string | null, bookingId: string): Promise<void> {
  const stripe = getStripe();
  if (!stripe || !paymentIntentId) return;
  try {
    await stripe.refunds.create({ payment_intent: paymentIntentId });
  } catch (e) {
    if (!(e instanceof Stripe.errors.StripeError && e.code === "charge_already_refunded")) throw e;
  }
  db.update(schema.bookings).set({ status: "refunded", stripePaymentIntentId: paymentIntentId, cancelledAt: nowIso() }).where(eq(schema.bookings.id, bookingId)).run();
  audit(null, "booking.orphan_payment_refunded", bookingId, paymentIntentId);
}

// ---------- partner annual fee ----------

/**
 * Extends a hotel's paid period. `source` (Checkout session id, invoice id, or "demo:…") makes the call idempotent:
 * the same source is never applied twice, so reloading a success page or a duplicate webhook cannot add extra years.
 */
export function applyFeePayment(hotelId: string, source: string, subscriptionId: string | null, periodEndUnix?: number | null): boolean {
  const hotel = db.select().from(schema.hotels).where(eq(schema.hotels.id, hotelId)).get();
  if (!hotel || hotel.lastFeeSource === source) return false;
  let until: Date;
  if (periodEndUnix) until = new Date(periodEndUnix * 1000);
  else { until = hotel.paidUntil && hotel.paidUntil > nowIso() ? new Date(hotel.paidUntil) : new Date(); until.setFullYear(until.getFullYear() + 1); }
  db.update(schema.hotels).set({
    paidUntil: until.toISOString(), stripeSubscriptionId: subscriptionId ?? hotel.stripeSubscriptionId, lastFeeSource: source,
  }).where(eq(schema.hotels.id, hotelId)).run();
  audit(null, "partner.fee_paid", hotelId, source);
  return true;
}

/** Current period end of a subscription, in unix seconds (null if unavailable). */
export async function subscriptionPeriodEnd(subscriptionId: string | null): Promise<number | null> {
  const stripe = getStripe();
  if (!stripe || !subscriptionId) return null;
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const ends = sub.items.data.map((i) => i.current_period_end).filter((n): n is number => typeof n === "number");
    return ends.length ? Math.max(...ends) : null;
  } catch {
    return null;
  }
}

/** Fallback when the fee webhook hasn't arrived yet. Only applies a session that belongs to this hotel. */
export async function reconcileFeeSession(ownerId: string, sessionId: string): Promise<void> {
  const stripe = getStripe();
  if (!stripe) return;
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const hotelId = session.metadata?.hotelId ?? "";
  if (!hotelId || session.metadata?.kind !== "partner_fee" || session.payment_status !== "paid") return;
  const hotel = db.select().from(schema.hotels).where(eq(schema.hotels.id, hotelId)).get();
  if (!hotel || hotel.ownerId !== ownerId || hotel.lastFeeSource === sessionId) return;
  const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
  applyFeePayment(hotelId, sessionId, subId, await subscriptionPeriodEnd(subId));
}
