"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit, requireRole } from "@/lib/auth";
import { APP_URL, sendEmail, templates } from "@/lib/email";
import { getBookingById } from "@/lib/booking-server";
import { recomputeRating } from "@/lib/reviews";
import { getStripe } from "@/lib/stripe";
import { nowIso } from "@/lib/ids";

async function admin() { return requireRole("head_admin"); }

export async function reviewHotel(formData: FormData): Promise<void> {
  const me = await admin();
  const hotelId = String(formData.get("hotelId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").slice(0, 1000);
  const hotel = db.select().from(schema.hotels).where(eq(schema.hotels.id, hotelId)).get();
  if (!hotel) redirect("/admin/registrations");
  const owner = hotel.ownerId ? db.select().from(schema.users).where(eq(schema.users.id, hotel.ownerId)).get() : null;
  const locale = owner?.locale === "en" ? "en" : "ja";

  if (decision === "approve") {
    db.update(schema.hotels).set({ status: "approved", reviewNote: note, reviewedAt: nowIso() }).where(eq(schema.hotels.id, hotelId)).run();
    if (owner) { const t = templates.partnerApproved(locale, hotel.nameJa, `${APP_URL}/${locale}/partner`); await sendEmail(owner.email, t.subject, t.body); }
  } else if (decision === "reject") {
    db.update(schema.hotels).set({ status: "rejected", reviewNote: note, reviewedAt: nowIso() }).where(eq(schema.hotels.id, hotelId)).run();
    if (owner) { const t = templates.partnerRejected(locale, hotel.nameJa, note); await sendEmail(owner.email, t.subject, t.body); }
  } else if (decision === "suspend") {
    db.update(schema.hotels).set({ status: "suspended", reviewNote: note, reviewedAt: nowIso() }).where(eq(schema.hotels.id, hotelId)).run();
  } else if (decision === "reinstate") {
    db.update(schema.hotels).set({ status: "approved", reviewNote: note, reviewedAt: nowIso() }).where(eq(schema.hotels.id, hotelId)).run();
  } else if (decision === "mark_paid") {
    const until = new Date(); until.setFullYear(until.getFullYear() + 1);
    db.update(schema.hotels).set({ paidUntil: until.toISOString() }).where(eq(schema.hotels.id, hotelId)).run();
  }
  audit(me.id, `admin.hotel.${decision}`, hotelId, note);
  revalidatePath("/admin");
  const back = String(formData.get("back") ?? "");
  redirect(back.startsWith("/admin") && !back.includes("\\") ? back : "/admin/registrations");
}

/** Closes a partner's change request after the admin has (or has not) applied it on the hotel page. */
export async function resolveChangeRequest(formData: FormData): Promise<void> {
  const me = await admin();
  const id = String(formData.get("requestId") ?? "");
  const decision = formData.get("decision") === "declined" ? "declined" : "done";
  const note = String(formData.get("note") ?? "").slice(0, 1000);
  const r = db.select().from(schema.changeRequests).where(eq(schema.changeRequests.id, id)).get();
  if (r && r.status === "open") {
    db.update(schema.changeRequests).set({ status: decision, adminNote: note, resolvedAt: nowIso() }).where(eq(schema.changeRequests.id, id)).run();
    const owner = db.select().from(schema.users).where(eq(schema.users.id, r.userId)).get();
    const hotel = db.select().from(schema.hotels).where(eq(schema.hotels.id, r.hotelId)).get();
    if (owner && hotel) {
      const locale = owner.locale === "en" ? "en" : "ja";
      const t = templates.changeRequestResolved(locale, hotel.nameJa, r.field, decision, note, `${APP_URL}/${locale}/partner/property`);
      await sendEmail(owner.email, t.subject, t.body);
    }
    audit(me.id, `admin.change_request.${decision}`, id, note);
  }
  revalidatePath("/admin/changes");
  redirect("/admin/changes");
}

export async function cancelBooking(formData: FormData): Promise<void> {
  const me = await admin();
  const id = String(formData.get("bookingId") ?? "");
  const refund = formData.get("refund") === "1";
  const b = getBookingById(id);
  if (!b || b.status === "cancelled" || b.status === "refunded") redirect("/admin/bookings");
  let status: schema.Booking["status"] = "cancelled";
  const stripe = getStripe();
  if (b.status === "pending_payment" && stripe && b.stripeSessionId) {
    try { await stripe.checkout.sessions.expire(b.stripeSessionId); } catch { /* already expired or completed; webhook refunds if paid */ }
  }
  if (refund && stripe && b.stripePaymentIntentId) {
    await stripe.refunds.create({ payment_intent: b.stripePaymentIntentId });
    status = "refunded";
  } else if (refund && b.paymentMode === "demo") {
    status = "refunded";
  }
  db.update(schema.bookings).set({ status, cancelledAt: nowIso() }).where(eq(schema.bookings.id, id)).run();
  audit(me.id, `admin.booking.${status}`, id);
  revalidatePath("/admin/bookings");
  redirect("/admin/bookings");
}

export async function setReviewVisibility(formData: FormData): Promise<void> {
  const me = await admin();
  const id = String(formData.get("reviewId") ?? "");
  const status = formData.get("status") === "hidden" ? "hidden" : "visible";
  const r = db.select().from(schema.reviews).where(eq(schema.reviews.id, id)).get();
  if (r) {
    db.update(schema.reviews).set({ status }).where(eq(schema.reviews.id, id)).run();
    recomputeRating(r.hotelId);
    audit(me.id, `admin.review.${status}`, id);
  }
  revalidatePath("/admin/reviews");
  redirect("/admin/reviews");
}

export async function setUserDisabled(formData: FormData): Promise<void> {
  const me = await admin();
  const id = String(formData.get("userId") ?? "");
  const disabled = formData.get("disabled") === "1";
  if (id !== me.id) {
    db.update(schema.users).set({ disabledAt: disabled ? nowIso() : null }).where(eq(schema.users.id, id)).run();
    if (disabled) db.delete(schema.sessions).where(eq(schema.sessions.userId, id)).run();
    audit(me.id, disabled ? "admin.user.disabled" : "admin.user.enabled", id);
  }
  revalidatePath("/admin/users");
  redirect("/admin/users");
}
