import "server-only";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { newId } from "./ids";
import { DB_PATH } from "@/db";

/**
 * Partner photos live next to the database (data/uploads/<hotelId>/<id>.jpg) and are served at /uploads/….
 * Every file is re-encoded as JPEG and capped at 1600px, so a 12 MB phone photo becomes a few hundred KB
 * and nothing but pixels ever gets stored.
 */
export const UPLOADS_DIR = path.resolve(path.dirname(DB_PATH), "uploads");
export const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
export const MAX_PHOTOS_PER_LISTING = 12;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export class UploadError extends Error {
  constructor(public code: "type" | "size" | "decode" | "limit") { super(code); }
}

export function isUploadUrl(u: string): boolean {
  return /^\/uploads\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.jpg$/.test(u);
}

function hotelDir(hotelId: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(hotelId)) throw new Error("bad hotel id");
  return path.join(UPLOADS_DIR, hotelId);
}

export async function storePhoto(hotelId: string, file: File): Promise<string> {
  if (!ACCEPTED.has(file.type)) throw new UploadError("type");
  if (file.size > MAX_PHOTO_BYTES) throw new UploadError("size");
  const input = Buffer.from(await file.arrayBuffer());
  let out: Buffer;
  try {
    out = await sharp(input, { failOn: "error" })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new UploadError("decode");
  }
  const dir = hotelDir(hotelId);
  fs.mkdirSync(dir, { recursive: true });
  const name = `${newId("p").replace(/[^A-Za-z0-9_-]/g, "")}.jpg`;
  fs.writeFileSync(path.join(dir, name), out);
  return `/uploads/${hotelId}/${name}`;
}

/** Absolute path for a stored upload URL, or null when the URL is not one of ours. */
export function uploadPath(url: string): string | null {
  if (!isUploadUrl(url)) return null;
  const [, , hotelId, file] = url.split("/");
  return path.join(hotelDir(hotelId), file);
}

/** Deletes files under a hotel's folder that the listing no longer references. */
export function pruneUploads(hotelId: string, keep: string[]): void {
  let dir: string;
  try { dir = hotelDir(hotelId); } catch { return; }
  if (!fs.existsSync(dir)) return;
  const wanted = new Set(keep.filter(isUploadUrl).map((u) => u.split("/").pop()!));
  for (const f of fs.readdirSync(dir)) {
    if (!wanted.has(f)) { try { fs.unlinkSync(path.join(dir, f)); } catch { /* already gone */ } }
  }
}

/** Public URL for an image: uploads become absolute so assistants and emails can use them. */
export function absoluteImage(url: string, origin: string): string {
  return url.startsWith("/") ? `${origin}${url}` : url;
}
