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
{"rooms":[{"name":"Tatami room","sleeps":2,"pricePerNight":18000,"quantity":4,"breakfast":true,"refundable":true}],"photos":["https://example.com/room.jpg"],"description":"...","amenities":"Wi-Fi, onsen","station":"Gion-Shijo","checkInTime":"3pm","checkOutTime":"10am"}
PUT is partial: send only what changes; anything left out stays. If you send rooms they replace the current set, so GET first and include the id of each room to keep.
Name, type, city, address, and map pin were set at registration and are confirmed by Yado. The API keeps them as they are.
English or Japanese is fine; Yado writes the other language. Price is yen per night. Say breakfast and refundable per room; the response lists anything it had to assume.
Photos: https links, or the owner uploads from their phone at ${origin}/partner (Edit listing → Photos).
Booking status: GET ${origin}/api/v1/bookings/{ref}?email= to see whether a guest has paid.
A second property only: POST ${origin}/api/v1/listings with name, city, address, pricePerNight, photos, mapsUrl, and newProperty: true.
A listing stays pending until Yado approves it and the owner pays the annual fee on the partner dashboard.
`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
