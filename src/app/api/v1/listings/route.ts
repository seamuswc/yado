import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { addListingForPartner } from "@/lib/listing-write";
import { listingBodySchema, listingFromBody } from "@/lib/api-schemas";
import { LISTING_NEXT, presentOwnedListing } from "@/lib/api-present";
import { apiError, apiJson, idempotent, limit, readActor, readJson, zodError } from "@/lib/api-http";
import { partnerHotels } from "@/lib/partner-server";

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
    const parsed = listingBodySchema.safeParse(body.data);
    if (!parsed.success) return zodError(parsed.error);
    if (parsed.data.account) return apiError(400, "invalid_input", "Do not send a password. The chatbot authenticates with the partner API key.");
    const listing = listingFromBody(parsed.data);
    const created = await addListingForPartner(actor.user.id, listing);
    const hotel = db.select().from(schema.hotels).where(and(eq(schema.hotels.id, created.hotelId), eq(schema.hotels.ownerId, actor.user.id))).get();
    return apiJson({
      listing: hotel ? presentOwnedListing(hotel) : { id: created.hotelId, slug: created.slug },
      message: LISTING_NEXT,
    }, 201);
  });
}
