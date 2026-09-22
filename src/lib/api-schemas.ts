import { z } from "zod";
import { addDays } from "./dates";
import { MAX_GUESTS } from "./stay";
import { amenityKeys, cities, type AmenityKey } from "./hotels-shared";
import type { NormalizedListing } from "./listing-write";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => addDays(s, 0) === s, "invalid date");
/** Photos are https links, or photos the owner uploaded on the partner site (/uploads/…). */
const photoUrl = z.string().trim().refine((s) => /^https:\/\/\S+$/.test(s) || /^\/uploads\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.jpg$/.test(s), "must be an https URL");

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
  phone: z.string().trim().max(40).default(""),
  licenseNumber: z.string().trim().max(80).default(""),
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
  images: z.array(photoUrl).max(12).default([]),
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

function textOf(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Whole number from 18000, "18,000", or "¥18000". */
function intOf(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  if (typeof v !== "string") return undefined;
  const n = Number(v.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

function boolOf(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "yes", "included", "1"].includes(s)) return true;
    if (["false", "no", "none", "0"].includes(s)) return false;
  }
  return undefined;
}

const typeWords: Record<string, "hotel" | "ryokan" | "business" | "hostel"> = {
  hotel: "hotel", ホテル: "hotel",
  ryokan: "ryokan", 旅館: "ryokan", inn: "ryokan",
  business: "business", "business hotel": "business", ビジネスホテル: "business",
  hostel: "hostel", ホステル: "hostel", guesthouse: "hostel", "guest house": "hostel", ゲストハウス: "hostel",
};

function typeOf(v: unknown): string {
  const s = textOf(v).toLowerCase();
  return typeWords[s] ?? (s ? Object.entries(typeWords).find(([k]) => s.includes(k))?.[1] : undefined) ?? "hotel";
}

const amenityWords: Record<string, AmenityKey> = {
  wifi: "wifi", "wi-fi": "wifi", "free wifi": "wifi", internet: "wifi",
  onsen: "onsen", "hot spring": "onsen", 温泉: "onsen",
  breakfast: "breakfast", 朝食: "breakfast",
  parking: "parking", 駐車場: "parking",
  restaurant: "restaurant", bar: "bar", gym: "gym", fitness: "gym", spa: "spa",
  laundry: "laundry", "luggage storage": "luggage", luggage: "luggage",
  tatami: "tatami", 和室: "tatami", "public bath": "bath", bath: "bath", 大浴場: "bath",
  "non-smoking": "nonSmoking", "non smoking": "nonSmoking", nonsmoking: "nonSmoking", 禁煙: "nonSmoking",
  accessible: "accessible", wheelchair: "accessible", バリアフリー: "accessible",
};

function amenitiesOf(v: unknown): string[] {
  const list = Array.isArray(v) ? v : typeof v === "string" ? v.split(/[,、]/) : [];
  const out = new Set<string>();
  for (const item of list) {
    const s = textOf(item).toLowerCase();
    if (!s) continue;
    if ((amenityKeys as string[]).includes(s)) { out.add(s); continue; }
    const key = amenityKeys.find((k) => k.toLowerCase() === s) ?? amenityWords[s] ?? Object.entries(amenityWords).find(([w]) => s.includes(w))?.[1];
    if (key) out.add(key);
  }
  return [...out];
}

/** "15:00", "3pm", "3 PM", "15" all become HH:MM. */
function timeOf(v: unknown, fallback: string): string {
  const s = textOf(v).toLowerCase();
  if (!s) return fallback;
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return fallback;
  let h = Number(m[1]);
  const min = m[2] ?? "00";
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  if (h > 23) return fallback;
  return `${String(h).padStart(2, "0")}:${min}`;
}

function cityIdOf(v: unknown): string {
  const raw = textOf(v);
  const s = raw.toLowerCase();
  if (!s) return "";
  const hit = cities.find((c) => c.id !== "other" && (c.id === s || c.name.en.toLowerCase() === s || raw === c.name.ja || s.includes(c.name.en.toLowerCase()) || raw.includes(c.name.ja)));
  return hit?.id ?? "other";
}

/** True when the text is exactly a city, with nothing extra such as a neighbourhood. */
function isBareCity(v: unknown): boolean {
  const raw = textOf(v);
  const s = raw.toLowerCase();
  return cities.some((c) => c.id === s || c.name.en.toLowerCase() === s || c.name.ja === raw);
}

/** Uploaded photos come back from GET as absolute URLs; accept them as the stored /uploads path. */
function urlList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string").map((s) => {
    const m = s.match(/^https?:\/\/[^/]+(\/uploads\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.jpg)$/);
    return m ? m[1] : s;
  });
}

const DEFAULT_ROOM_NAME = "Standard room";

/**
 * Defaults the API filled in because the caller did not say. Returned to the assistant so it can ask the owner
 * instead of silently publishing a guess (a refundable room that is not, for example).
 */
export function assumedDefaults(input: unknown): string[] {
  if (!input || typeof input !== "object") return [];
  const v = input as Record<string, unknown>;
  const out: string[] = [];
  const rooms = Array.isArray(v.rooms) && v.rooms.length ? v.rooms : [v];
  const unstated = (key: string) => rooms.some((r) => !r || typeof r !== "object" || boolOf((r as Record<string, unknown>)[key]) === undefined);
  if (unstated("refundable")) out.push("refundable: true (free cancellation). Send refundable: false per room if bookings are non-refundable.");
  if (unstated("breakfast")) out.push("breakfast: false. Send breakfast: true per room if it is included.");
  if (rooms.some((r) => r && typeof r === "object" && !textOf((r as Record<string, unknown>).nameJa) && !textOf((r as Record<string, unknown>).name) && !textOf((r as Record<string, unknown>).nameEn) && !textOf((r as Record<string, unknown>).roomName))) out.push(`room name: "${DEFAULT_ROOM_NAME}".`);
  return out;
}

export function assumedNote(assumed: string[]): string {
  return assumed.length ? ` Not stated, so assumed: ${assumed.join(" ")} Confirm these with the owner.` : "";
}

/** Accepts the short brief an assistant actually sends: name, place, nightly price, photos. */
export function coerceListingBody(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const v = input as Record<string, unknown>;
  const name = textOf(v.nameJa) || textOf(v.name) || textOf(v.nameEn);
  const nameEn = textOf(v.nameEn) || textOf(v.name) || name;
  const city = cityIdOf(v.city) || cityIdOf(v.location) || cityIdOf(v.near) || "other";
  // "Gion, Kyoto" in the city field keeps Gion as the address.
  const placeText = [v.location, v.city, v.near].map(textOf).find((s) => s && !isBareCity(s)) ?? "";
  const address = textOf(v.address) || placeText || cities.find((c) => c.id === city)?.name.en || "Japan";
  const written = textOf(v.descriptionJa) || textOf(v.description) || textOf(v.descriptionEn);
  const description = written.length >= 10 ? written : `${name || "Hotel"} in ${address}.`;
  const images = urlList(v.images).length ? urlList(v.images) : urlList(v.photos);
  const given = Array.isArray(v.rooms) ? v.rooms : [];
  const rooms = given.length > 0 ? given.map((item) => {
    if (!item || typeof item !== "object") return item;
    const r = item as Record<string, unknown>;
    const roomName = textOf(r.nameJa) || textOf(r.name) || textOf(r.nameEn) || DEFAULT_ROOM_NAME;
    const roomText = textOf(r.descriptionJa) || textOf(r.description) || textOf(r.descriptionEn);
    return {
      ...r,
      nameJa: roomName,
      nameEn: textOf(r.nameEn) || textOf(r.name) || roomName,
      descriptionJa: roomText,
      descriptionEn: textOf(r.descriptionEn) || textOf(r.description) || roomText,
      sleeps: intOf(r.sleeps ?? r.guests ?? r.capacity) ?? 2,
      quantity: intOf(r.quantity ?? r.count ?? r.rooms) ?? 1,
      pricePerNight: intOf(r.pricePerNight ?? r.price ?? r.pricePerNightJpy),
      sizeSqm: intOf(r.sizeSqm ?? r.size) ?? null,
      breakfast: boolOf(r.breakfast) ?? false,
      refundable: boolOf(r.refundable) ?? true,
    };
  }) : [{
    nameJa: textOf(v.roomName) || textOf(v.room) || DEFAULT_ROOM_NAME,
    nameEn: textOf(v.roomName) || textOf(v.room) || DEFAULT_ROOM_NAME,
    sleeps: intOf(v.sleeps ?? v.guests) ?? 2,
    quantity: intOf(v.quantity ?? v.roomCount) ?? 1,
    pricePerNight: intOf(v.pricePerNight ?? v.price ?? v.pricePerNightJpy),
    breakfast: boolOf(v.breakfast) ?? false,
    refundable: boolOf(v.refundable) ?? true,
  }];
  return {
    ...v,
    nameJa: name,
    nameEn,
    descriptionJa: description,
    descriptionEn: textOf(v.descriptionEn) || textOf(v.description) || description,
    type: typeOf(v.type),
    city,
    address,
    phone: textOf(v.phone),
    licenseNumber: textOf(v.licenseNumber ?? v.licence ?? v.license),
    stationJa: textOf(v.stationJa) || textOf(v.station) || textOf(v.nearestStation),
    stationEn: textOf(v.stationEn) || textOf(v.station) || textOf(v.nearestStation) || undefined,
    checkInTime: timeOf(v.checkInTime ?? v.checkIn, "15:00"),
    checkOutTime: timeOf(v.checkOutTime ?? v.checkOut, "11:00"),
    amenities: amenitiesOf(v.amenities),
    images,
    rooms,
  };
}

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
  guests: z.number().int().min(1).max(MAX_GUESTS),
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
