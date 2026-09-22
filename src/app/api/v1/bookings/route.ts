import { clientIp } from "@/lib/auth";
import { bookingsForGuest, bookingsForHotels, getBookingById } from "@/lib/booking-server";
import { partnerHotels } from "@/lib/partner-server";
import { bookingBodySchema } from "@/lib/api-schemas";
import { presentBooking } from "@/lib/api-present";
import { apiError, apiJson, idempotent, limit, readActor, readJson, zodError } from "@/lib/api-http";
import { startGuestBooking, type BookingFailure } from "@/lib/start-booking";

export const dynamic = "force-dynamic";

const failures: Record<BookingFailure, { status: number; code: string; message: string }> = {
  notFound: { status: 404, code: "not_found", message: "That hotel or room is not available to book. Search again and use a room id from the results." },
  invalidDates: { status: 400, code: "invalid_dates", message: "Check-in must be today or later in Japan, and check-out must be after check-in." },
  tooManyGuests: { status: 400, code: "too_many_guests", message: "This room cannot sleep that many guests." },
  notAvailable: { status: 409, code: "not_available", message: "That room is sold out for those dates." },
  stripe: { status: 502, code: "payment_unavailable", message: "Stripe Checkout could not be started. The room was not held. Do not ask the guest for a card number." },
  stripe_not_configured: { status: 503, code: "stripe_not_configured", message: "Card payment is Stripe Checkout only. This server has no STRIPE_SECRET_KEY, so the stay was not booked. Do not ask the guest for a card number in the chat." },
};

export async function GET(req: Request) {
  const limited = await limit("api:bookings", 60, 60_000);
  if (limited) return limited;
  const { actor, response } = await readActor(req);
  if (response) return response;
  if (!actor) return apiError(401, "unauthorized", "Send a guest or partner API key to list bookings. A single booking can also be read with its view token at GET /api/v1/bookings/{ref}?token=…");
  const rows = actor.user.role === "partner"
    ? bookingsForHotels(partnerHotels(actor.user.id).map((h) => h.id))
    : actor.user.role === "guest"
      ? bookingsForGuest(actor.user.id, actor.user.email)
      : [];
  return apiJson({ bookings: rows.map(presentBooking) });
}

export async function POST(req: Request) {
  const limited = await limit("api:book", 20, 10 * 60_000);
  if (limited) return limited;
  const { actor, response } = await readActor(req);
  if (response) return response;
  const ip = await clientIp();
  return idempotent(req, actor?.user.id ?? ip, async () => {
    const body = await readJson(req);
    if ("response" in body) return body.response;
    const parsed = bookingBodySchema.safeParse(body.data);
    if (!parsed.success) return zodError(parsed.error);
    const v = parsed.data;
    if (actor?.user.role === "guest" && v.email !== actor.user.email) {
      return apiError(400, "email_mismatch", `This API key books as ${actor.user.email}. Use that email, or omit the API key to book as someone else.`);
    }
    const result = await startGuestBooking({
      locale: v.locale,
      hotelSlug: v.hotelId,
      roomId: v.roomId,
      checkIn: v.checkIn,
      checkOut: v.checkOut,
      guests: v.guests,
      firstName: v.firstName,
      lastName: v.lastName,
      email: v.email,
      phone: v.phone,
      requests: v.requests,
      userId: actor?.user.role === "guest" ? actor.user.id : null,
      via: "api",
    });
    if (!result.ok) {
      const f = failures[result.error];
      return apiError(f.status, f.code, f.message);
    }
    const booking = getBookingById(result.booking.id);
    if (!booking) return apiError(500, "error", "The booking was created but could not be loaded.");
    const confirmationUrl = result.confirmationUrl;
    if (!result.paymentUrl) {
      return apiJson({
        ...presentBooking(booking),
        paymentUrl: null,
        confirmationUrl,
        viewToken: result.viewToken,
        cardEntry: "demo",
        message: "This demo server has no Stripe key, so no card was charged and the stay is confirmed. Send the guest to confirmationUrl. On a live server you would send them to paymentUrl instead, and you still must not ask for the card number.",
      }, 201);
    }
    return apiJson({
      ...presentBooking(booking),
      paymentUrl: result.paymentUrl,
      confirmationUrl,
      viewToken: result.viewToken,
      cardEntry: "stripe_checkout",
      message: "The room is held, not paid. Do not ask for the card number, expiry, or CVC. Send the guest to paymentUrl. They enter the card on Stripe. The booking stays pending_payment until Stripe confirms payment.",
    }, 201);
  });
}
