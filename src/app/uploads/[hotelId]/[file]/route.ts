import fs from "node:fs";
import { uploadPath } from "@/lib/uploads";

/** Serves partner photos from data/uploads. Files are immutable (new upload = new name), so they cache for a year. */
export async function GET(_req: Request, ctx: { params: Promise<{ hotelId: string; file: string }> }) {
  const { hotelId, file } = await ctx.params;
  const p = uploadPath(`/uploads/${hotelId}/${file}`);
  if (!p || !fs.existsSync(p)) return new Response("Not found", { status: 404 });
  // Stored photos are re-encoded and capped at 1600px, so reading the whole file is a few hundred KB at most.
  const body = new Uint8Array(fs.readFileSync(p));
  return new Response(body, {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(body.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
