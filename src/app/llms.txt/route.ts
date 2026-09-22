import { APP_URL } from "@/lib/email";

export const dynamic = "force-dynamic";

export function GET() {
  const origin = APP_URL;
  const body = `# Yado

Hotel booking for Japan. Guests search and book. Hotels create listings.

API index: ${origin}/api/v1
OpenAPI: ${origin}/api/v1/openapi.json

Guests need no API key.
Search: GET ${origin}/api/v1/hotels?near=&checkIn=&checkOut=&guests=&maxPricePerNight=
Book: POST ${origin}/api/v1/bookings
Do not ask for a card number. If the response has paymentUrl, send the guest there to pay. If it has confirmationUrl, the stay is confirmed.

Hotels send Authorization: Bearer yado_… (the key from the partner API page).
Create a listing: POST ${origin}/api/v1/listings
{"name":"Sakura Inn","city":"Kyoto","address":"Gion","pricePerNight":18000,"photos":["https://example.com/room.jpg"],"mapsUrl":"https://maps.app.goo.gl/…"}
English is fine. Photos are https. Price is yen per night. mapsUrl is the hotel's Google Maps link.
`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
