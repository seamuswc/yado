import "server-only";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { amenityKeys, cities, typeLabel, type AmenityKey } from "./hotels-shared";
import type { ListingRoomInput, NormalizedListing } from "./listing-write";
import { anthropic } from "./translate";

const DraftOut = z.object({
  nameEn: z.string(),
  descriptionJa: z.string(),
  descriptionEn: z.string(),
  areaJa: z.string(),
  areaEn: z.string(),
  stationJa: z.string(),
  stationEn: z.string(),
  accessJa: z.string(),
  accessEn: z.string(),
  amenities: z.array(z.string()),
  checkInTime: z.string(),
  checkOutTime: z.string(),
  rooms: z.array(z.object({
    nameJa: z.string(),
    nameEn: z.string(),
    descriptionJa: z.string(),
    descriptionEn: z.string(),
    sleeps: z.number(),
    sizeSqm: z.number().nullable(),
    pricePerNight: z.number(),
    quantity: z.number(),
    breakfast: z.boolean(),
    refundable: z.boolean(),
  })),
});

export type PropertyBasics = {
  name: string;
  type: NormalizedListing["type"];
  city: string;
  address: string;
};

type Drafted = Pick<NormalizedListing,
  "nameEn" | "descriptionJa" | "descriptionEn" | "areaJa" | "areaEn" | "stationJa" | "stationEn" |
  "accessJa" | "accessEn" | "amenities" | "checkInTime" | "checkOutTime" | "rooms">;

function clip(s: string, max: number): string {
  return s.trim().slice(0, max);
}

function clamp(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function timeOr(s: string, fallback: string): string {
  return /^\d{2}:\d{2}$/.test(s) ? s : fallback;
}

const cityFactor: Record<string, number> = {
  tokyo: 1.25, kyoto: 1.15, osaka: 1.05, hakone: 1.35, okinawa: 1.1, nara: 1, hiroshima: 0.95, fukuoka: 0.95, sapporo: 1,
};

function yen(base: number, city: string): number {
  const n = Math.round((base * (cityFactor[city] ?? 1)) / 100) * 100;
  return clamp(n, 500, 5_000_000, base);
}

function starterRooms(type: PropertyBasics["type"], city: string): ListingRoomInput[] {
  const room = (nameJa: string, nameEn: string, descriptionJa: string, descriptionEn: string, sleeps: number, size: number | null, price: number, quantity: number, breakfast: boolean): ListingRoomInput => ({
    nameJa, nameEn, descriptionJa, descriptionEn, sleeps, sizeSqm: size, pricePerNight: yen(price, city), quantity, breakfast, refundable: true,
  });
  if (type === "ryokan") {
    return [
      room("和室", "Japanese room", "畳の和室。浴衣付き。", "Tatami room with yukata.", 2, 20, 28000, 4, true),
      room("和室（二食付き）", "Japanese room with meals", "夕食と朝食付きの和室。", "Tatami room with dinner and breakfast.", 2, 24, 42000, 3, true),
    ];
  }
  if (type === "business") {
    return [
      room("シングル", "Single", "ビジネス向けのシングル。", "Single room for a short stay.", 1, 14, 9000, 10, false),
      room("ツイン", "Twin", "シングルベッド2台。", "Two single beds.", 2, 18, 14000, 6, false),
    ];
  }
  if (type === "hostel") {
    return [
      room("ドミトリー", "Dorm bed", "共有ドミトリーの1床。", "One bed in a shared dorm.", 1, null, 4500, 12, false),
      room("個室", "Private room", "少人数向けの個室。", "A private room for a couple.", 2, 12, 12000, 3, false),
    ];
  }
  return [
    room("ダブル", "Double", "ダブルベッド1台の客室。", "One double bed.", 2, 18, 18000, 6, false),
    room("ツイン", "Twin", "シングルベッド2台の客室。", "Two single beds.", 2, 20, 20000, 4, false),
  ];
}

function starterDraft(input: PropertyBasics): Drafted {
  const city = cities.find((c) => c.id === input.city);
  const type = typeLabel[input.type];
  const cityJa = city?.name.ja ?? input.city;
  const cityEn = city?.name.en ?? input.city;
  const amenities: AmenityKey[] = input.type === "ryokan"
    ? ["wifi", "onsen", "tatami", "bath"]
    : input.type === "hostel" ? ["wifi", "luggage"]
    : input.type === "business" ? ["wifi", "laundry", "nonSmoking"]
    : ["wifi"];
  return {
    nameEn: input.name,
    descriptionJa: `${input.name}は${cityJa}の${type.ja}です。${input.address}`,
    descriptionEn: `${input.name} is a ${type.en.toLowerCase()} in ${cityEn}. ${input.address}`,
    areaJa: "", areaEn: "", stationJa: "", stationEn: "", accessJa: "", accessEn: "",
    amenities, checkInTime: "15:00", checkOutTime: "11:00",
    rooms: starterRooms(input.type, input.city),
  };
}

function cleanDraft(raw: z.infer<typeof DraftOut>, input: PropertyBasics): Drafted {
  const allowed = new Set<string>(amenityKeys);
  const rooms = raw.rooms.slice(0, 6).map((r) => ({
    nameJa: clip(r.nameJa, 80),
    nameEn: clip(r.nameEn, 80),
    descriptionJa: clip(r.descriptionJa, 300),
    descriptionEn: clip(r.descriptionEn, 300),
    sleeps: clamp(r.sleeps, 1, 12, 2),
    sizeSqm: r.sizeSqm == null ? null : clamp(r.sizeSqm, 0, 1000, 0) || null,
    pricePerNight: clamp(Math.round(r.pricePerNight / 100) * 100, 500, 5_000_000, 10000),
    quantity: clamp(r.quantity, 1, 500, 1),
    breakfast: r.breakfast,
    refundable: r.refundable,
  })).filter((r) => r.nameJa.length > 0);
  const base = starterDraft(input);
  return {
    nameEn: clip(raw.nameEn, 120) || input.name,
    descriptionJa: clip(raw.descriptionJa, 3000) || base.descriptionJa,
    descriptionEn: clip(raw.descriptionEn, 3000) || base.descriptionEn,
    areaJa: clip(raw.areaJa, 120),
    areaEn: clip(raw.areaEn, 120),
    stationJa: clip(raw.stationJa, 80),
    stationEn: clip(raw.stationEn, 80),
    accessJa: clip(raw.accessJa, 500),
    accessEn: clip(raw.accessEn, 500),
    amenities: raw.amenities.filter((a): a is AmenityKey => allowed.has(a)),
    checkInTime: timeOr(raw.checkInTime, "15:00"),
    checkOutTime: timeOr(raw.checkOutTime, "11:00"),
    rooms: rooms.length ? rooms : base.rooms,
  };
}

/** Writes the description and room types from the few fields the owner typed. */
export async function draftProperty(input: PropertyBasics): Promise<Drafted> {
  const fallback = starterDraft(input);
  const client = anthropic();
  if (!client) return fallback;
  try {
    const res = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 8000,
      output_config: { effort: "low", format: zodOutputFormat(DraftOut) },
      system:
        "You draft a Japan hotel listing from a name, property type, city id, and address. " +
        "Write 2 to 4 realistic room types for that kind of property in that city. " +
        "Prices are yen per night including tax, typical for the area, rounded to 100 yen. " +
        "Write Japanese and English for the name, description, area, station, access, and each room. " +
        "Keep the owner's name as nameEn only when it is already English; otherwise give a natural English name. " +
        "station and area stay empty when the address does not support them. " +
        `amenities must be chosen only from: ${amenityKeys.join(", ")}. ` +
        "checkInTime and checkOutTime are HH:MM. Do not invent a phone number or licence.",
      messages: [{ role: "user", content: JSON.stringify(input) }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) return fallback;
    return cleanDraft(res.parsed_output, input);
  } catch (e) {
    const msg = e instanceof Anthropic.APIError ? `API error ${e.status}: ${e.message}` : (e as Error).message;
    console.warn("draftProperty failed:", msg);
    return fallback;
  }
}
