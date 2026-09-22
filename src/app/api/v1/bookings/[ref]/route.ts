import { timingSafeEqual } from "node:crypto";
import { getBookingByRef } from "@/lib/booking-server";
import { partnerHotels } from "@/lib/partner-server";
import { presentBooking } from "@/lib/api-present";
import { apiError, apiJson, limit, readActor } from "@/lib/api-http";
import { sha256 } from "@/lib/ids";

export const dynamic = "force-dynamic";

function hashEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(req: Request, ctx: { params: Promise<{ ref: string }> }) {
  const limited = await limit("api:bookings", 60, 60_000);
  if (limited) return limited;
  const { ref } = await ctx.params;
  const hidden = apiError(404, "not_found", "No booking with that reference. Pass token= the viewToken from createBooking, or email= the guest's email, or use the guest or partner API key.");
  const booking = getBookingByRef(ref);
  if (!booking) return hidden;
  const { actor, response } = await readActor(req);
  if (response) return response;
  const params = new URL(req.url).searchParams;
  const token = params.get("token") ?? "";
  const email = (params.get("email") ?? "").trim().toLowerCase();
  const tokenOk = !!token && !!booking.viewTokenHash && hashEquals(sha256(token), booking.viewTokenHash);
  const emailOk = !!email && hashEquals(email, booking.email.toLowerCase());
  const guestOk = !!actor && actor.user.role === "guest" && (actor.user.id === booking.userId || actor.user.email === booking.email);
  const partnerOk = !!actor && actor.user.role === "partner" && partnerHotels(actor.user.id).some((h) => h.id === booking.hotelId);
  const adminOk = actor?.user.role === "head_admin";
  if (!tokenOk && !emailOk && !guestOk && !partnerOk && !adminOk) return hidden;
  const message = booking.status === "pending_payment"
    ? "Not paid yet. The guest still has to finish on the payment page. Check again after they say they have paid."
    : booking.status === "confirmed"
      ? "Paid and confirmed. A confirmation email has been sent to the guest."
      : booking.status === "cancelled"
        ? "Cancelled. If the guest never paid, the payment window passed and the room was released; book again if they still want it."
        : "Refunded.";
  return apiJson({ booking: presentBooking(booking), message });
}
