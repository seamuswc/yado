import { z } from "zod";
import { addDays } from "./dates";
import { amenityKeys, cities, type AmenityKey } from "./hotels-shared";
import type { NormalizedListing } from "./listing-write";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => addDays(s, 0) === s, "invalid date");
const httpsUrl = z.string().trim().regex(/^https:\/\/\S+$/, "must be an https URL");

export const roomBodySchema = z.object({
  id: z.string().min(1).max(40).optional(),
  nameJa: z.string().trim().min(1).max(80),
  descriptionJa: z.string().trim().max(300).default(""),
  nameEn: z.string().trim().max(80).optional(),
  descriptionEn: z.string().trim().max(300).optional(),
  sleeps: z.number().int().min(1).max(12),
  sizeSqm: z.number().int().min(0).max(1000).nullable().optional(),
  pricePerNight: z.number().int().min(500).max(5_000_000),
  quantity: z.number().int().min(1).max(500),
  breakfast: z.boolean().default(false),
  refundable: z.boolean().default(true),
});

export const listingBodySchema = z.object({
  nameJa: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().max(120).optional(),
  type: z.enum(["hotel", "ryokan", "business", "hostel"]),
  city: z.string().refine((c) => cities.some((x) => x.id === c), "use a city id from GET /api/v1/cities"),
  address: z.string().trim().min(3).max(300),
  phone: z.string().trim().min(5).max(40),
  licenseNumber: z.string().trim().min(2).max(80),
  stationJa: z.string().trim().max(80).default(""),
  stationEn: z.string().trim().max(80).optional(),
  areaJa: z.string().trim().max(120).default(""),
  areaEn: z.string().trim().max(120).optional(),
  descriptionJa: z.string().trim().min(10).max(3000),
  descriptionEn: z.string().trim().max(3000).optional(),
  accessJa: z.string().trim().max(500).default(""),
  accessEn: z.string().trim().max(500).optional(),
  checkInTime: z.string().regex(/^\d{2}:\d{2}$/).default("15:00"),
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/).default("11:00"),
  amenities: z.array(z.string()).default([]),
  images: z.array(httpsUrl).max(12).default([]),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  rooms: z.array(roomBodySchema).min(1).max(30),
  retranslate: z.boolean().optional(),
  locale: z.enum(["en", "ja"]).default("ja"),
  account: z.object({
    contactName: z.string().trim().min(1).max(100),
    email: z.string().trim().toLowerCase().email().max(200),
    password: z.string().min(10).max(200),
  }).optional(),
});

export type ListingBody = z.infer<typeof listingBodySchema>;

export function listingFromBody(v: ListingBody): NormalizedListing {
  const allowed = new Set<string>(amenityKeys);
  return {
    nameJa: v.nameJa,
    nameEn: v.nameEn,
    type: v.type,
    city: v.city,
    address: v.address,
    phone: v.phone,
    licenseNumber: v.licenseNumber,
    stationJa: v.stationJa,
    stationEn: v.stationEn,
    areaJa: v.areaJa,
    areaEn: v.areaEn,
    descriptionJa: v.descriptionJa,
    descriptionEn: v.descriptionEn,
    accessJa: v.accessJa,
    accessEn: v.accessEn,
    checkInTime: v.checkInTime,
    checkOutTime: v.checkOutTime,
    amenities: v.amenities.filter((a): a is AmenityKey => allowed.has(a)),
    images: v.images,
    latitude: v.latitude ?? null,
    longitude: v.longitude ?? null,
    rooms: v.rooms.map((r) => ({
      id: r.id,
      nameJa: r.nameJa,
      descriptionJa: r.descriptionJa,
      nameEn: r.nameEn,
      descriptionEn: r.descriptionEn,
      sleeps: r.sleeps,
      sizeSqm: r.sizeSqm ?? null,
      pricePerNight: r.pricePerNight,
      quantity: r.quantity,
      breakfast: r.breakfast,
      refundable: r.refundable,
    })),
  };
}

export function englishFromBody(v: ListingBody) {
  return {
    nameEn: v.nameEn ?? "",
    areaEn: v.areaEn ?? "",
    descriptionEn: v.descriptionEn ?? "",
    accessEn: v.accessEn ?? "",
    stationEn: v.stationEn ?? "",
  };
}

export const bookingBodySchema = z.object({
  hotelId: z.string().trim().min(1).max(80),
  roomId: z.string().trim().min(1).max(40),
  checkIn: isoDate,
  checkOut: isoDate,
  guests: z.number().int().min(1).max(8),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z.string().trim().min(5).max(40),
  requests: z.string().trim().max(1000).default(""),
  locale: z.enum(["en", "ja"]).default("en"),
});

export const tokenBodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
  label: z.string().trim().max(40).default("assistant"),
});
