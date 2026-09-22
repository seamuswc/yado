import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit, createUser, findUserByEmail } from "./auth";
import { amenityKeys } from "./hotels-shared";
import type { Locale } from "./i18n";
import { newId, slugify } from "./ids";
import { translateListing } from "./translate";

export class ListingError extends Error {
  constructor(public code: "exists") { super(code); }
}

export type ListingRoomInput = {
  id?: string;
  nameJa: string;
  descriptionJa: string;
  nameEn?: string;
  descriptionEn?: string;
  sleeps: number;
  sizeSqm: number | null;
  pricePerNight: number;
  quantity: number;
  breakfast: boolean;
  refundable: boolean;
};

/** Listing fields after validation. Japanese is the source of truth; English is optional. */
export type NormalizedListing = {
  nameJa: string;
  type: "hotel" | "ryokan" | "business" | "hostel";
  city: string;
  address: string;
  phone: string;
  licenseNumber: string;
  stationJa: string;
  areaJa: string;
  descriptionJa: string;
  accessJa: string;
  checkInTime: string;
  checkOutTime: string;
  amenities: string[];
  images: string[];
  latitude: number | null;
  longitude: number | null;
  nameEn?: string;
  areaEn?: string;
  descriptionEn?: string;
  accessEn?: string;
  stationEn?: string;
  rooms: ListingRoomInput[];
};

type PreparedEnglish = {
  translation: schema.Hotel["translation"];
  name: string;
  area: string;
  description: string;
  access: string;
  station: string;
  rooms: { name: string; description: string }[];
};

function hasManualEnglish(L: NormalizedListing): boolean {
  return !!L.nameEn && !!L.descriptionEn && L.descriptionEn !== L.descriptionJa;
}

async function translateShort(ja: string): Promise<string> {
  if (!ja) return "";
  const r = await translateListing({ name: ja, area: "", description: "", access: "", rooms: [] });
  return r.machine ? (r.en.name || ja) : ja;
}

/** Uses English supplied by the caller when it is a real translation; otherwise machine-translates from Japanese. */
export async function resolveEnglish(L: NormalizedListing): Promise<PreparedEnglish> {
  if (!L.descriptionJa && L.rooms.length === 0) {
    return { translation: "pending", name: L.nameEn || L.nameJa, area: "", description: "", access: "", station: "", rooms: [] };
  }
  if (hasManualEnglish(L)) {
    return {
      translation: "manual",
      name: L.nameEn!,
      area: L.areaEn || L.areaJa,
      description: L.descriptionEn!,
      access: L.accessEn || L.accessJa,
      station: L.stationEn || L.stationJa,
      rooms: L.rooms.map((r) => ({ name: r.nameEn || r.nameJa, description: r.descriptionEn || r.descriptionJa })),
    };
  }
  const tr = await translateListing({
    name: L.nameJa, area: L.areaJa, description: L.descriptionJa, access: L.accessJa,
    rooms: L.rooms.map((r) => ({ name: r.nameJa, description: r.descriptionJa })),
  });
  return {
    translation: tr.machine ? "machine" : "pending",
    name: tr.en.name || L.nameJa,
    area: tr.en.area,
    description: tr.en.description || L.descriptionJa,
    access: tr.en.access,
    station: L.stationJa ? await translateShort(L.stationJa) : "",
    rooms: L.rooms.map((r, i) => ({ name: tr.en.rooms[i]?.name ?? r.nameJa, description: tr.en.rooms[i]?.description ?? r.descriptionJa })),
  };
}

function cleanAmenities(keys: string[]): string[] {
  return keys.filter((a) => (amenityKeys as string[]).includes(a));
}

/** Inserts a pending hotel and its rooms. Call inside a transaction when it must commit with other writes. */
export function insertListingRows(userId: string, hotelId: string, L: NormalizedListing, en: PreparedEnglish): string {
  let slug = slugify(en.name || L.nameJa);
  if (db.select({ id: schema.hotels.id }).from(schema.hotels).where(eq(schema.hotels.slug, slug)).get()) {
    slug = `${slug}-${hotelId.slice(2, 8).toLowerCase()}`;
  }
  db.insert(schema.hotels).values({
    id: hotelId, slug, ownerId: userId,
    nameJa: L.nameJa, nameEn: en.name, city: L.city, areaJa: L.areaJa, areaEn: en.area, type: L.type,
    descriptionJa: L.descriptionJa, descriptionEn: en.description, accessJa: L.accessJa, accessEn: en.access,
    stationJa: L.stationJa, stationEn: en.station, latitude: L.latitude, longitude: L.longitude,
    amenities: cleanAmenities(L.amenities), images: L.images,
    checkInTime: L.checkInTime, checkOutTime: L.checkOutTime,
    legalName: L.nameJa, address: L.address, phone: L.phone, licenseNumber: L.licenseNumber,
    translation: en.translation, status: "pending",
  }).run();
  L.rooms.forEach((r, i) => {
    db.insert(schema.rooms).values({
      id: newId("r_"), hotelId, nameJa: r.nameJa, nameEn: en.rooms[i]?.name ?? r.nameJa,
      descriptionJa: r.descriptionJa, descriptionEn: en.rooms[i]?.description ?? r.descriptionJa,
      sleeps: r.sleeps, sizeSqm: r.sizeSqm, pricePerNight: r.pricePerNight, quantity: r.quantity,
      breakfast: r.breakfast, refundable: r.refundable, sortOrder: i,
    }).run();
  });
  return slug;
}

/** New partner account plus their first listing. The listing stays pending until review. */
export async function registerPartnerWithListing(input: {
  contactName: string;
  email: string;
  password: string;
  locale: Locale;
  listing: NormalizedListing;
}): Promise<{ user: schema.User; hotelId: string; slug: string; translation: schema.Hotel["translation"] }> {
  if (findUserByEmail(input.email)) throw new ListingError("exists");
  const en = await resolveEnglish(input.listing);
  const hotelId = newId("h_");
  const user = db.transaction(() => {
    if (findUserByEmail(input.email)) throw new ListingError("exists");
    const created = createUser({
      email: input.email, name: input.contactName, role: "partner", password: input.password, locale: input.locale,
    });
    const slug = insertListingRows(created.id, hotelId, input.listing, en);
    return { created, slug };
  });
  audit(user.created.id, "partner.registered", hotelId, en.translation);
  return { user: user.created, hotelId, slug: user.slug, translation: en.translation };
}

/** Another property on an existing partner account. */
export async function addListingForPartner(userId: string, L: NormalizedListing): Promise<{ hotelId: string; slug: string; translation: schema.Hotel["translation"] }> {
  const en = await resolveEnglish(L);
  const hotelId = newId("h_");
  const slug = db.transaction(() => insertListingRows(userId, hotelId, L, en));
  audit(userId, "partner.registered", hotelId, en.translation);
  return { hotelId, slug, translation: en.translation };
}

/**
 * Replaces the public copy of a listing the caller owns.
 * A rejected listing goes back to pending. A live listing stays live.
 */
export async function savePartnerListing(
  hotel: schema.Hotel,
  L: NormalizedListing,
  english: { nameEn: string; areaEn: string; descriptionEn: string; accessEn: string; stationEn: string },
  opts: { retranslate: boolean; fillEnglish: boolean },
  actorId: string,
): Promise<schema.Hotel["translation"]> {
  let en = {
    name: english.nameEn,
    area: english.areaEn,
    description: english.descriptionEn,
    access: english.accessEn,
    station: english.stationEn,
  };
  let roomsEn = L.rooms.map((r) => ({ name: r.nameEn ?? "", description: r.descriptionEn ?? "" }));
  const englishChanged = en.name !== hotel.nameEn || en.description !== hotel.descriptionEn || en.area !== hotel.areaEn || en.access !== hotel.accessEn;
  const looksUntranslated = !en.name || en.name === L.nameJa || !en.description || en.description === L.descriptionJa;
  let translation: schema.Hotel["translation"] = looksUntranslated ? "pending" : englishChanged ? "manual" : hotel.translation;
  if (opts.retranslate || (opts.fillEnglish && looksUntranslated)) {
    const prepared = await resolveEnglish({ ...L, nameEn: undefined, descriptionEn: undefined, areaEn: undefined, accessEn: undefined, stationEn: undefined });
    en = { name: prepared.name, area: prepared.area, description: prepared.description, access: prepared.access, station: prepared.station };
    roomsEn = prepared.rooms;
    translation = prepared.translation;
  }

  const status = hotel.status === "rejected" ? "pending" : hotel.status;
  db.update(schema.hotels).set({
    nameJa: L.nameJa, nameEn: en.name || L.nameJa, type: L.type, city: L.city, areaJa: L.areaJa, areaEn: en.area,
    descriptionJa: L.descriptionJa, descriptionEn: en.description || L.descriptionJa, accessJa: L.accessJa, accessEn: en.access,
    stationJa: L.stationJa, stationEn: en.station, latitude: L.latitude, longitude: L.longitude,
    amenities: cleanAmenities(L.amenities), images: L.images,
    checkInTime: L.checkInTime, checkOutTime: L.checkOutTime, address: L.address, phone: L.phone, licenseNumber: L.licenseNumber,
    translation, status,
  }).where(eq(schema.hotels.id, hotel.id)).run();

  const existing = db.select().from(schema.rooms).where(eq(schema.rooms.hotelId, hotel.id)).all();
  const keep = new Set<string>();
  L.rooms.forEach((r, i) => {
    const values = {
      nameJa: r.nameJa, nameEn: roomsEn[i]?.name || r.nameJa, descriptionJa: r.descriptionJa, descriptionEn: roomsEn[i]?.description || r.descriptionJa,
      sleeps: r.sleeps, sizeSqm: r.sizeSqm, pricePerNight: r.pricePerNight, quantity: r.quantity, breakfast: r.breakfast, refundable: r.refundable, sortOrder: i, active: true,
    };
    const ex = r.id ? existing.find((x) => x.id === r.id) : undefined;
    if (ex) { db.update(schema.rooms).set(values).where(eq(schema.rooms.id, ex.id)).run(); keep.add(ex.id); }
    else { const id = newId("r_"); db.insert(schema.rooms).values({ id, hotelId: hotel.id, ...values }).run(); keep.add(id); }
  });
  for (const ex of existing) if (!keep.has(ex.id)) db.update(schema.rooms).set({ active: false }).where(eq(schema.rooms.id, ex.id)).run();

  audit(actorId, "partner.listing_updated", hotel.id, opts.retranslate ? "retranslated" : "");
  return translation;
}
