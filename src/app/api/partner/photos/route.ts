import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit, getCurrentUser } from "@/lib/auth";
import { MAX_PHOTOS_PER_LISTING, storePhoto, UploadError } from "@/lib/uploads";

export const dynamic = "force-dynamic";

const messages: Record<UploadError["code"], string> = {
  type: "Use JPEG, PNG, WebP, or HEIC photos.",
  size: "Each photo must be under 12 MB.",
  decode: "That file could not be read as a photo.",
  limit: `A listing can have up to ${MAX_PHOTOS_PER_LISTING} photos.`,
};

/**
 * Signed-in partner (or admin) uploads photos for a listing they own.
 * multipart/form-data: hotelId, existing (how many photos are already on the form), files[]
 * Returns the URLs to add to the listing's photo list.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "partner" && user.role !== "head_admin")) return Response.json({ error: "Sign in first." }, { status: 401 });
  const form = await req.formData();
  const hotelId = String(form.get("hotelId") ?? "");
  const existing = Number(form.get("existing") ?? 0) || 0;
  const hotel = db.select({ id: schema.hotels.id }).from(schema.hotels)
    .where(user.role === "head_admin" ? eq(schema.hotels.id, hotelId) : and(eq(schema.hotels.id, hotelId), eq(schema.hotels.ownerId, user.id)))
    .get();
  if (!hotel) return Response.json({ error: "No listing of yours with that id." }, { status: 404 });
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return Response.json({ error: "Choose at least one photo." }, { status: 400 });
  if (existing + files.length > MAX_PHOTOS_PER_LISTING) return Response.json({ error: messages.limit }, { status: 400 });
  const urls: string[] = [];
  const errors: string[] = [];
  for (const f of files) {
    try {
      urls.push(await storePhoto(hotel.id, f));
    } catch (e) {
      errors.push(`${f.name}: ${e instanceof UploadError ? messages[e.code] : "upload failed"}`);
    }
  }
  if (urls.length) audit(user.id, "partner.photos_uploaded", hotel.id, String(urls.length));
  return Response.json({ urls, errors });
}
