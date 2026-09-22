import { APP_URL } from "@/lib/email";
import { apiJson } from "@/lib/api-http";
import { stripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export function GET() {
  const root = `${APP_URL}/api/v1`;
  return apiJson({
    name: "Yado",
    payments: stripeConfigured() ? "stripe" : "stripe_not_configured",
    description: "Search and book hotels in Japan, or create a hotel listing, from ChatGPT, Grok, or any assistant that can call HTTPS.",
    openapi: `${root}/openapi.json`,
    guests: {
      search: `GET ${root}/hotels?near=shinjuku&checkIn=2026-11-01&checkOut=2026-11-03&guests=2&maxTotal=40000`,
      book: `POST ${root}/bookings`,
      payment: "Stripe Checkout. The assistant never takes the card number. The guest opens paymentUrl and enters the card there.",
    },
    hotels: {
      register: `POST ${root}/listings`,
      token: `POST ${root}/auth/token`,
      note: "The hotel pastes an API key into the chatbot (Authorization: Bearer yado_…). The assistant can then create a listing with photo URLs, nightly price, and location. Create the key on the partner dashboard.",
    },
  });
}
