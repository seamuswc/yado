import "server-only";
import { and, asc, eq, gt, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Locale } from "./i18n";
import { nowIso } from "./ids";

export type { Localized, AmenityKey, City } from "./hotels-shared";
export { amenityKeys, cities, sortKeys, typeLabel } from "./hotels-shared";
import { amenityKeys, cities, type AmenityKey, type Localized, type City, type SortKey } from "./hotels-shared";

export type Room = {
  id: string;
  name: Localized;
  description: Localized;
  sleeps: number;
  pricePerNight: number; // JPY, tax included
  breakfast: boolean;
  refundable: boolean;
  quantity: number;
  sizeSqm: number | null;
  image: string;
};

/** Public, locale-neutral view of a hotel. `id` is the URL slug; `dbId` is the row id. */
export type Hotel = {
  id: string;
  dbId: string;
  name: Localized;
  city: string;
  area: Localized;
  type: "hotel" | "ryokan" | "business" | "hostel";
  rating: number;
  reviewCount: number;
  description: Localized;
  access: Localized;
  station: Localized;
  latitude: number | null;
  longitude: number | null;
  address: string;
  amenities: AmenityKey[];
  checkIn: string;
  checkOut: string;
  images: string[];
  rooms: Room[];
};

export function t(l: Localized, locale: Locale): string {
  return l[locale] || l.en || l.ja;
}

export function getCity(id: string): City | undefined {
  return cities.find((c) => c.id === id);
}

export function minPrice(hotel: Hotel): number {
  return hotel.rooms.length ? Math.min(...hotel.rooms.map((r) => r.pricePerNight)) : 0;
}

export function maxSize(hotel: Hotel): number {
  return Math.max(0, ...hotel.rooms.map((r) => r.sizeSqm ?? 0));
}

/** Google Maps link (opens in a new tab). Uses coordinates when known, otherwise name + address. */
export function mapsUrl(hotel: Pick<Hotel, "latitude" | "longitude" | "name" | "address">, locale: Locale): string {
  const base = "https://www.google.com/maps/search/?api=1&query=";
  if (hotel.latitude != null && hotel.longitude != null) return `${base}${hotel.latitude},${hotel.longitude}`;
  return base + encodeURIComponent(`${t(hotel.name, locale)} ${hotel.address}`.trim());
}

// ---------- mapping ----------

export function toRoom(r: schema.Room): Room {
  return {
    id: r.id,
    name: { en: r.nameEn, ja: r.nameJa },
    description: { en: r.descriptionEn, ja: r.descriptionJa },
    sleeps: r.sleeps, pricePerNight: r.pricePerNight, breakfast: r.breakfast, refundable: r.refundable,
    quantity: r.quantity, sizeSqm: r.sizeSqm, image: r.image,
  };
}

export function toHotel(h: schema.Hotel, rooms: schema.Room[]): Hotel {
  return {
    id: h.slug,
    dbId: h.id,
    name: { en: h.nameEn, ja: h.nameJa },
    city: h.city,
    area: { en: h.areaEn, ja: h.areaJa },
    type: h.type,
    rating: h.rating,
    reviewCount: h.reviewCount,
    description: { en: h.descriptionEn, ja: h.descriptionJa },
    access: { en: h.accessEn, ja: h.accessJa },
    station: { en: h.stationEn, ja: h.stationJa },
    latitude: h.latitude,
    longitude: h.longitude,
    address: h.address,
    amenities: h.amenities.filter((a): a is AmenityKey => (amenityKeys as string[]).includes(a)),
    checkIn: h.checkInTime,
    checkOut: h.checkOutTime,
    images: h.images,
    rooms: rooms.filter((r) => r.active).sort((a, b) => a.sortOrder - b.sortOrder || a.pricePerNight - b.pricePerNight).map(toRoom),
  };
}

// ---------- queries ----------

/** Listing is live only when approved and the annual fee is paid up. */
export const liveHotelFilter = () => and(eq(schema.hotels.status, "approved"), gt(schema.hotels.paidUntil, nowIso()));

export function isLive(h: Pick<schema.Hotel, "status" | "paidUntil">): boolean {
  return h.status === "approved" && !!h.paidUntil && h.paidUntil > nowIso();
}

function roomsFor(hotelIds: string[]): Map<string, schema.Room[]> {
  const map = new Map<string, schema.Room[]>();
  if (hotelIds.length === 0) return map;
  const rows = db.select().from(schema.rooms).where(inArray(schema.rooms.hotelId, hotelIds)).orderBy(asc(schema.rooms.sortOrder)).all();
  for (const r of rows) map.set(r.hotelId, [...(map.get(r.hotelId) ?? []), r]);
  return map;
}

export function listLiveHotels(): Hotel[] {
  const rows = db.select().from(schema.hotels).where(liveHotelFilter()).all();
  const rooms = roomsFor(rows.map((h) => h.id));
  return rows.map((h) => toHotel(h, rooms.get(h.id) ?? [])).filter((h) => h.rooms.length > 0);
}

export function getLiveHotel(slug: string): Hotel | undefined {
  const h = db.select().from(schema.hotels).where(and(eq(schema.hotels.slug, slug), liveHotelFilter())).get();
  if (!h) return undefined;
  const rooms = db.select().from(schema.rooms).where(eq(schema.rooms.hotelId, h.id)).all();
  const hotel = toHotel(h, rooms);
  return hotel.rooms.length ? hotel : undefined;
}

export type SearchParams = {
  q?: string;
  city?: string;
  guests?: number;
  minPrice?: number;
  maxPrice?: number;
  sort?: SortKey;
};

export function searchHotels(params: SearchParams): Hotel[] {
  const q = (params.q ?? "").trim().toLowerCase();
  const guests = params.guests ?? 1;
  let min = params.minPrice;
  let max = params.maxPrice;
  if (min != null && max != null && min > max) [min, max] = [max, min];
  let list = listLiveHotels().flatMap((h) => {
    if (params.city && h.city !== params.city) return [];
    if (q) {
      const cityName = getCity(h.city);
      const hay = [h.name.en, h.name.ja, h.area.en, h.area.ja, h.station.en, h.station.ja, h.address, h.city, cityName?.name.en ?? "", cityName?.name.ja ?? ""].join(" ").toLowerCase();
      if (!hay.includes(q)) return [];
    }
    const rooms = h.rooms.filter((r) => r.sleeps >= guests && (min == null || r.pricePerNight >= min) && (max == null || r.pricePerNight <= max));
    return rooms.length ? [{ ...h, rooms }] : [];
  });
  switch (params.sort) {
    case "priceLow": list = [...list].sort((a, b) => minPrice(a) - minPrice(b)); break;
    case "priceHigh": list = [...list].sort((a, b) => minPrice(b) - minPrice(a)); break;
    case "rating": list = [...list].sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount); break;
    case "size": list = [...list].sort((a, b) => maxSize(b) - maxSize(a)); break;
    case "sizeSmall": list = [...list].sort((a, b) => (maxSize(a) || Infinity) - (maxSize(b) || Infinity)); break;
    default: list = [...list].sort((a, b) => b.reviewCount * b.rating - a.reviewCount * a.rating);
  }
  return list;
}
