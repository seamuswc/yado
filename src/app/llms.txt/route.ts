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
The owner registered the property on the website, so it already exists.
Find it: GET ${origin}/api/v1/listings
Add rooms, photos, and details: PUT ${origin}/api/v1/listings/{id}
{"rooms":[{"name":"Tatami room","sleeps":2,"pricePerNight":18000,"quantity":4,"breakfast":true}],"photos":["https://example.com/room.jpg"],"description":"...","amenities":"Wi-Fi, onsen","station":"Gion-Shijo","checkInTime":"3pm","checkOutTime":"10am"}
Name, type, city, address, and map pin were set at registration and are confirmed by Yado. The API keeps them as they are.
English is fine. Photos are https. Price is yen per night.
A second property only: POST ${origin}/api/v1/listings with name, city, address, pricePerNight, photos, mapsUrl, and newProperty: true.
`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
