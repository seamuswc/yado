import "server-only";
import { and, eq, or } from "drizzle-orm";
import { db, schema } from "@/db";
import type { BookingWithHotel } from "./booking-server";
import { availabilityForHotel } from "./booking-server";
import { isLive, minPrice, type Hotel } from "./hotels";
import { nightsBetween } from "./i18n";

export const LISTING_NEXT = "This listing is not public yet. Confirm the partner email, wait for an admin to approve it, then pay the annual fee. Only live listings appear in search.";

export function presentStayRoom(hotel: Hotel, checkIn?: string, checkOut?: string) {
  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;
  const avail = checkIn && checkOut ? availabilityForHotel(hotel.dbId, checkIn, checkOut) : null;
  const rooms = hotel.rooms.flatMap((r) => {
    const available = avail ? (avail.get(r.id) ?? 0) : undefined;
    if (avail && !available) return [];
    return [{
      id: r.id,
      name: r.name,
      description: r.description,
      sleeps: r.sleeps,
      sizeSqm: r.sizeSqm,
      pricePerNightJpy: r.pricePerNight,
      breakfast: r.breakfast,
      refundable: r.refundable,
      ...(available != null ? { available, totalJpy: r.pricePerNight * nights } : {}),
    }];
  });
  return rooms;
}

export function presentHotelSummary(hotel: Hotel, checkIn?: string, checkOut?: string) {
  return {
    id: hotel.id,
    name: hotel.name,
    city: hotel.city,
    area: hotel.area,
    type: hotel.type,
    rating: hotel.rating,
    reviewCount: hotel.reviewCount,
    station: hotel.station,
    minPricePerNightJpy: minPrice(hotel),
    checkInTime: hotel.checkIn,
    checkOutTime: hotel.checkOut,
    rooms: presentStayRoom(hotel, checkIn, checkOut),
  };
}

/** Drops rooms that cannot take the party or that cost more than the stated budget. */
export function narrowRooms<T extends { sleeps: number; pricePerNightJpy: number; totalJpy?: number }>(
  rooms: T[],
  opts: { guests?: number; maxPricePerNight?: number | null; maxTotal?: number | null },
): T[] {
  return rooms.filter((r) => {
    if (opts.guests != null && r.sleeps < opts.guests) return false;
    if (opts.maxPricePerNight != null && r.pricePerNightJpy > opts.maxPricePerNight) return false;
    if (opts.maxTotal != null && (r.totalJpy == null || r.totalJpy > opts.maxTotal)) return false;
    return true;
  });
}

export function presentHotelDetail(hotel: Hotel, checkIn?: string, checkOut?: string) {
  return {
    ...presentHotelSummary(hotel, checkIn, checkOut),
    description: hotel.description,
    access: hotel.access,
    address: hotel.address,
    amenities: hotel.amenities,
    images: hotel.images,
    latitude: hotel.latitude,
    longitude: hotel.longitude,
  };
}

export function presentBooking(b: BookingWithHotel) {
  return {
    ref: b.ref,
    status: b.status,
    hotelId: b.hotel.slug,
    hotelName: { en: b.hotel.nameEn, ja: b.hotel.nameJa },
    roomId: b.roomId,
    roomName: b.room ? { en: b.room.nameEn, ja: b.room.nameJa } : null,
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    nights: b.nights,
    guests: b.guests,
    totalJpy: b.total,
    currency: b.currency,
    guest: { email: b.email, phone: b.phone },
    requests: b.requests,
  };
}

export function presentOwnedListing(hotel: schema.Hotel) {
  const rooms = db.select().from(schema.rooms).where(and(eq(schema.rooms.hotelId, hotel.id), eq(schema.rooms.active, true))).all();
  return {
    id: hotel.id,
    slug: hotel.slug,
    status: hotel.status,
    live: isLive(hotel),
    translation: hotel.translation,
    paidUntil: hotel.paidUntil,
    reviewNote: hotel.reviewNote,
    nameJa: hotel.nameJa,
    nameEn: hotel.nameEn,
    type: hotel.type,
    city: hotel.city,
    address: hotel.address,
    phone: hotel.phone,
    licenseNumber: hotel.licenseNumber,
    stationJa: hotel.stationJa,
    stationEn: hotel.stationEn,
    areaJa: hotel.areaJa,
    areaEn: hotel.areaEn,
    descriptionJa: hotel.descriptionJa,
    descriptionEn: hotel.descriptionEn,
    accessJa: hotel.accessJa,
    accessEn: hotel.accessEn,
    checkInTime: hotel.checkInTime,
    checkOutTime: hotel.checkOutTime,
    amenities: hotel.amenities,
    images: hotel.images,
    latitude: hotel.latitude,
    longitude: hotel.longitude,
    rooms: rooms.map((r) => ({
      id: r.id,
      nameJa: r.nameJa,
      nameEn: r.nameEn,
      descriptionJa: r.descriptionJa,
      descriptionEn: r.descriptionEn,
      sleeps: r.sleeps,
      sizeSqm: r.sizeSqm,
      pricePerNight: r.pricePerNight,
      quantity: r.quantity,
      breakfast: r.breakfast,
      refundable: r.refundable,
    })),
  };
}

export function ownedHotel(userId: string, idOrSlug: string) {
  return db.select().from(schema.hotels).where(and(
    eq(schema.hotels.ownerId, userId),
    or(eq(schema.hotels.id, idOrSlug), eq(schema.hotels.slug, idOrSlug)),
  )).get();
}
