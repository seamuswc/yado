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
  if (L.nameJa !== hotel.nameJa || (L.nameEn && L.nameEn !== hotel.nameEn && L.nameEn !== hotel.nameJa)) kept.push("name");
  if (L.type !== hotel.type) kept.push("type");
  if (L.city !== hotel.city) kept.push("city");
  if (L.address !== hotel.address) kept.push("address");
  if ((L.latitude ?? null) !== hotel.latitude || (L.longitude ?? null) !== hotel.longitude) kept.push("map pin");
  return {
    kept,
    listing: { ...L, nameJa: hotel.nameJa, nameEn: hotel.nameEn, type: hotel.type as NormalizedListing["type"], city: hotel.city, address: hotel.address, latitude: hotel.latitude, longitude: hotel.longitude },
  };
}

export function keptNote(kept: string[]): string {
  if (kept.length === 0) return "";
  return ` The ${kept.join(", ")} stayed as registered: those details are confirmed by Yado and cannot be changed here. To change them, the owner emails ${publicContactEmail()}.`;
}

/**
 * Makes an update partial: anything the caller leaves out (rooms, photos, description, times, amenities…) is
 * filled from the stored listing, so "change check-in to 2pm" cannot wipe the rooms or delete uploaded photos.
 * Registration fields always come from the store. Notes a map change it will not apply.
 */
export function mergeWithRegistered(hotel: schema.Hotel, raw: unknown, rooms: schema.Room[] = []): { body: Record<string, unknown>; attempted: string[] } {
  const body = raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
  const attempted: string[] = [];
  const pinSent = body.mapsUrl != null || body.googleMapsUrl != null || body.latitude != null || body.longitude != null;
  if (pinSent) attempted.push("map pin");
  delete body.location;
  delete body.near;
  delete body.mapsUrl;
  delete body.googleMapsUrl;

  const sent = (...keys: string[]) => keys.some((k) => body[k] != null && body[k] !== "");
  const fill: Record<string, unknown> = {};
  if (!sent("description", "descriptionJa", "descriptionEn")) { fill.descriptionJa = hotel.descriptionJa; fill.descriptionEn = hotel.descriptionEn; }
  if (!sent("station", "stationJa", "stationEn", "nearestStation")) { fill.stationJa = hotel.stationJa; fill.stationEn = hotel.stationEn; }
  if (!sent("areaJa", "areaEn")) { fill.areaJa = hotel.areaJa; fill.areaEn = hotel.areaEn; }
  if (!sent("accessJa", "accessEn")) { fill.accessJa = hotel.accessJa; fill.accessEn = hotel.accessEn; }
  if (!sent("checkInTime", "checkIn")) fill.checkInTime = hotel.checkInTime;
  if (!sent("checkOutTime", "checkOut")) fill.checkOutTime = hotel.checkOutTime;
  if (!sent("amenities")) fill.amenities = hotel.amenities;
  if (!sent("images", "photos")) fill.images = hotel.images;
  if (!sent("phone")) fill.phone = hotel.phone;
  if (!sent("licenseNumber", "licence", "license")) fill.licenseNumber = hotel.licenseNumber;
  if (!sent("rooms", "pricePerNight", "price", "pricePerNightJpy") && rooms.length > 0) {
    fill.rooms = rooms.map((r) => ({
      id: r.id, nameJa: r.nameJa, nameEn: r.nameEn, descriptionJa: r.descriptionJa, descriptionEn: r.descriptionEn,
      sleeps: r.sleeps, sizeSqm: r.sizeSqm, pricePerNight: r.pricePerNight, quantity: r.quantity, breakfast: r.breakfast, refundable: r.refundable,
    }));
  }

  return {
    attempted,
    body: {
      ...fill,
      ...body,
      // Sent values pass through here so keepRegisteredFields can report what the caller tried to change.
      nameJa: body.nameJa ?? body.name ?? hotel.nameJa,
      type: body.type ?? hotel.type,
      city: body.city ?? hotel.city,
      address: body.address ?? hotel.address,
      latitude: hotel.latitude,
      longitude: hotel.longitude,
    },
  };
}
