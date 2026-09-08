import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { cancelPendingBooking, getBookingById } from "@/lib/booking-server";
import { applyFeePayment, refundOrphanPayment, settleBookingPayment, subscriptionPeriodEnd } from "@/lib/payments";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { nowIso } from "@/lib/ids";

export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig ?? "", secret);
  } catch (e) {
    return NextResponse.json({ error: `Invalid signature: ${(e as Error).message}` }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object;
      if (s.mode === "payment" && s.metadata?.bookingId && s.payment_status === "paid") {
        const pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? null;
        const settled = await settleBookingPayment(s.metadata.bookingId, s.id, pi);
        if (!settled) {
          // Paid, but the booking is no longer pending (e.g. cancelled by admin meanwhile): give the money back.
          const b = getBookingById(s.metadata.bookingId);
          if (b && b.status !== "confirmed") await refundOrphanPayment(pi, b.id);
        }
      }
      if (s.mode === "subscription" && s.metadata?.kind === "partner_fee" && s.metadata.hotelId) {
        const subId = typeof s.subscription === "string" ? s.subscription : s.subscription?.id ?? null;
        applyFeePayment(s.metadata.hotelId, s.id, subId, await subscriptionPeriodEnd(subId));
      }
      break;
    }
    case "checkout.session.expired": {
      const s = event.data.object;
      if (s.metadata?.bookingId) cancelPendingBooking(s.metadata.bookingId);
      break;
    }
    case "invoice.paid": {
      // Yearly renewals: extend paidUntil to the end of the new period.
      const inv = event.data.object;
      const subId = typeof inv.parent?.subscription_details?.subscription === "string" ? inv.parent.subscription_details.subscription : null;
      if (subId) {
        const hotel = db.select().from(schema.hotels).where(eq(schema.hotels.stripeSubscriptionId, subId)).get();
        const periodEnd = inv.lines?.data?.[0]?.period?.end ?? null;
        if (hotel) applyFeePayment(hotel.id, inv.id, subId, periodEnd);
      }
      break;
    }
    case "charge.refunded": {
      const ch = event.data.object;
      const pi = typeof ch.payment_intent === "string" ? ch.payment_intent : ch.payment_intent?.id;
      if (pi) db.update(schema.bookings).set({ status: "refunded", cancelledAt: nowIso() }).where(eq(schema.bookings.stripePaymentIntentId, pi)).run();
      break;
    }
    default:
      break;
  }
  return NextResponse.json({ received: true });
}
