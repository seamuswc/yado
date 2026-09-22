import "server-only";
import type * as schema from "@/db/schema";
import { publicContactEmail } from "./email";
import type { NormalizedListing } from "./listing-write";

/**
 * Name, type, city, address, and map pin were set by the owner at registration and checked by Yado.
 * An assistant cannot change them. The stored values win, and the caller is told which ones it tried to change.
 */
export function keepRegisteredFields(hotel: schema.Hotel, L: NormalizedListing): { listing: NormalizedListing; kept: string[] } {
  const kept: string[] = [];
  if (L.nameJa !== hotel.nameJa) kept.push("name");
  if (L.type !== hotel.type) kept.push("type");
  if (L.city !== hotel.city) kept.push("city");
  if (L.address !== hotel.address) kept.push("address");
  if ((L.latitude ?? null) !== hotel.latitude || (L.longitude ?? null) !== hotel.longitude) kept.push("map pin");
  return {
    kept,
    listing: { ...L, nameJa: hotel.nameJa, type: hotel.type as NormalizedListing["type"], city: hotel.city, address: hotel.address, latitude: hotel.latitude, longitude: hotel.longitude },
  };
}

export function keptNote(kept: string[]): string {
  if (kept.length === 0) return "";
  return ` The ${kept.join(", ")} stayed as registered: those details are confirmed by Yado and cannot be changed here. To change them, the owner emails ${publicContactEmail()}.`;
}

/** Fills registration fields from the stored listing so an update only has to carry what it adds. Notes a map change it will not apply. */
export function mergeWithRegistered(hotel: schema.Hotel, raw: unknown): { body: Record<string, unknown>; attempted: string[] } {
  const body = raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
  const attempted: string[] = [];
  const pinSent = body.mapsUrl != null || body.googleMapsUrl != null || body.latitude != null || body.longitude != null;
  if (pinSent) attempted.push("map pin");
  delete body.location;
  delete body.near;
  delete body.mapsUrl;
  delete body.googleMapsUrl;
  return {
    attempted,
    body: {
      ...body,
      nameJa: body.nameJa ?? body.name ?? hotel.nameJa,
      type: body.type ?? hotel.type,
      city: body.city ?? hotel.city,
      address: body.address ?? hotel.address,
      latitude: hotel.latitude,
      longitude: hotel.longitude,
    },
  };
}
