import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { englishFromBody, listingBodySchema, listingFromBody } from "@/lib/api-schemas";
import { ownedHotel, presentOwnedListing } from "@/lib/api-present";
import { savePartnerListing } from "@/lib/listing-write";
import { apiError, apiJson, idempotent, limit, readActor, readJson, zodError } from "@/lib/api-http";

export const dynamic = "force-dynamic";

async function partner(req: Request) {
  const { actor, response } = await readActor(req);
  if (response) return { response };
  if (!actor || actor.user.role !== "partner") {
    return { response: apiError(403, "forbidden", "A partner API key is required.") };
  }
  return { actor };
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const limited = await limit("api:listings", 60, 60_000);
  if (limited) return limited;
  const auth = await partner(req);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  const hotel = ownedHotel(auth.actor.user.id, id);
  if (!hotel) return apiError(404, "not_found", "No listing of yours with that id.");
  return apiJson({ listing: presentOwnedListing(hotel) });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const limited = await limit("api:listings", 30, 10 * 60_000);
  if (limited) return limited;
  const auth = await partner(req);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  return idempotent(req, auth.actor.user.id, async () => {
    const hotel = ownedHotel(auth.actor.user.id, id);
    if (!hotel) return apiError(404, "not_found", "No listing of yours with that id.");
    const body = await readJson(req);
    if ("response" in body) return body.response;
    const parsed = listingBodySchema.safeParse(body.data);
    if (!parsed.success) return zodError(parsed.error);
    if (parsed.data.account) return apiError(400, "invalid_input", "Do not send account when updating a listing.");
    const translation = await savePartnerListing(
      hotel,
      listingFromBody(parsed.data),
      englishFromBody(parsed.data),
      { retranslate: parsed.data.retranslate === true, fillEnglish: true },
      auth.actor.user.id,
    );
    const updated = db.select().from(schema.hotels).where(eq(schema.hotels.id, hotel.id)).get();
    return apiJson({
      listing: updated ? presentOwnedListing(updated) : { id: hotel.id, translation },
      message: updated?.status === "pending"
        ? "Saved. The listing stays hidden until an admin approves it and the annual fee is paid."
        : "Saved.",
    });
  });
}
