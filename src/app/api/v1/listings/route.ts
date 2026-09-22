import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { addListingForPartner } from "@/lib/listing-write";
import { coerceListingBody, listingBodySchema, listingFromBody } from "@/lib/api-schemas";
import { isoInDays } from "@/lib/ids";
import { demoPaymentsAllowed } from "@/lib/stripe";
import { LISTING_NEXT, presentOwnedListing } from "@/lib/api-present";
import { apiError, apiJson, idempotent, limit, readActor, readJson, zodError } from "@/lib/api-http";
import { partnerHotels } from "@/lib/partner-server";
import { MapsLinkError, resolveMapsLink } from "@/lib/maps-link";

/** A Google Maps link becomes the pin, the same as on the registration form. */
async function withMapsPin(body: unknown): Promise<unknown> {
  if (!body || typeof body !== "object") return body;
  const v = body as Record<string, unknown>;
  const link = typeof v.mapsUrl === "string" ? v.mapsUrl : typeof v.googleMapsUrl === "string" ? v.googleMapsUrl : "";
  if (!link || (typeof v.latitude === "number" && typeof v.longitude === "number")) return body;
  const pin = await resolveMapsLink(link);
  return { ...v, latitude: pin.latitude ?? undefined, longitude: pin.longitude ?? undefined };
}

export const dynamic = "force-dynamic";

const KEY_REQUIRED = "A partner API key is required. Create it on the partner dashboard (or POST /api/v1/auth/token) and paste it into the chatbot as Authorization: Bearer yado_…. Do not put the key in the chat message.";

export async function GET(req: Request) {
  const limited = await limit("api:listings", 60, 60_000);
  if (limited) return limited;
  const { actor, response } = await readActor(req);
  if (response) return response;
  if (!actor) return apiError(401, "unauthorized", KEY_REQUIRED);
  if (actor.user.role !== "partner") return apiError(403, "forbidden", KEY_REQUIRED);
  return apiJson({ listings: partnerHotels(actor.user.id).map(presentOwnedListing) });
}

export async function POST(req: Request) {
  const { actor, response } = await readActor(req);
  if (response) return response;
  if (!actor) return apiError(401, "unauthorized", KEY_REQUIRED);
  if (actor.user.role !== "partner") return apiError(403, "forbidden", KEY_REQUIRED);
  const limited = await limit("api:listing-write", 30, 10 * 60_000);
  if (limited) return limited;
  return idempotent(req, actor.user.id, async () => {
    const body = await readJson(req);
    if ("response" in body) return body.response;
    let data: unknown;
    try {
      data = await withMapsPin(body.data);
    } catch (e) {
      if (e instanceof MapsLinkError) return apiError(400, "invalid_input", "mapsUrl: paste a Google Maps link, such as https://maps.app.goo.gl/… or a maps.google.com link.");
      throw e;
    }
    const parsed = listingBodySchema.safeParse(coerceListingBody(data));
    if (!parsed.success) return zodError(parsed.error);
    if (parsed.data.account) return apiError(400, "invalid_input", "Do not send a password. The chatbot authenticates with the partner API key.");
    const listing = listingFromBody(parsed.data);
    const created = await addListingForPartner(actor.user.id, listing);
    let hotel = db.select().from(schema.hotels).where(and(eq(schema.hotels.id, created.hotelId), eq(schema.hotels.ownerId, actor.user.id))).get();
    const liveNow = demoPaymentsAllowed();
    if (liveNow && hotel) {
      db.update(schema.hotels).set({ status: "approved", paidUntil: isoInDays(365) }).where(eq(schema.hotels.id, hotel.id)).run();
      hotel = db.select().from(schema.hotels).where(eq(schema.hotels.id, hotel.id)).get();
    }
    return apiJson({
      listing: hotel ? presentOwnedListing(hotel) : { id: created.hotelId, slug: created.slug },
      message: liveNow
        ? "The listing is live and bookable. This is a test server with no Stripe key, so approval and the annual fee were skipped on purpose. On the production server a new listing stays pending until an admin approves it and the fee is paid."
        : LISTING_NEXT,
    }, 201);
  });
}
