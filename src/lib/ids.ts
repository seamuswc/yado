import { randomBytes, createHash } from "node:crypto";

export function newId(prefix = ""): string {
  return prefix + randomBytes(12).toString("base64url");
}

/** URL-safe random secret (for sessions and email links). */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function bookingRef(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let out = "YD-";
  for (let i = 0; i < 6; i++) out += chars[bytes[i] % chars.length];
  return out;
}

export function slugify(s: string): string {
  const base = s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (base.length >= 3) return base.slice(0, 60);
  // Non-Latin names (e.g. Japanese without a translation yet): readable random slug.
  return "hotel-" + randomBytes(4).toString("hex");
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function isoInDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}
