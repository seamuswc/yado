import type * as schema from "@/db/schema";

export type RoomDraft = {
  id?: string; nameJa: string; nameEn?: string; descriptionJa: string; descriptionEn?: string;
  sleeps: number; sizeSqm: number | null; pricePerNight: number; quantity: number; breakfast: boolean; refundable: boolean;
};
export type ListingDraft = {
  hotelId?: string; nameJa: string; nameEn?: string; type: string; city: string; address: string; phone: string; licenseNumber: string;
  stationJa: string; stationEn?: string; areaJa: string; areaEn?: string; descriptionJa: string; descriptionEn?: string; accessJa: string; accessEn?: string;
  checkInTime: string; checkOutTime: string; amenities: string[]; images: string[]; latitude: number | null; longitude: number | null;
  translation?: "pending" | "machine" | "manual";
  rooms: RoomDraft[];
};

export const emptyRoom: RoomDraft = { nameJa: "", descriptionJa: "", sleeps: 2, sizeSqm: null, pricePerNight: 10000, quantity: 1, breakfast: false, refundable: true };

export function emptyListing(): ListingDraft {
  return { nameJa: "", type: "hotel", city: "tokyo", address: "", phone: "", licenseNumber: "", stationJa: "", areaJa: "", descriptionJa: "", accessJa: "", checkInTime: "15:00", checkOutTime: "11:00", amenities: [], images: [], latitude: null, longitude: null, rooms: [{ ...emptyRoom }] };
}

export function toDraft(h: schema.Hotel, rooms: schema.Room[]): ListingDraft {
  return {
    hotelId: h.id, nameJa: h.nameJa, nameEn: h.nameEn, type: h.type, city: h.city, address: h.address, phone: h.phone, licenseNumber: h.licenseNumber,
    stationJa: h.stationJa, stationEn: h.stationEn, areaJa: h.areaJa, areaEn: h.areaEn, descriptionJa: h.descriptionJa, descriptionEn: h.descriptionEn,
    accessJa: h.accessJa, accessEn: h.accessEn, checkInTime: h.checkInTime, checkOutTime: h.checkOutTime, amenities: h.amenities, images: h.images,
    latitude: h.latitude, longitude: h.longitude, translation: h.translation,
    rooms: rooms.filter((r) => r.active).sort((a, b) => a.sortOrder - b.sortOrder).map((r) => ({
      id: r.id, nameJa: r.nameJa, nameEn: r.nameEn, descriptionJa: r.descriptionJa, descriptionEn: r.descriptionEn,
      sleeps: r.sleeps, sizeSqm: r.sizeSqm, pricePerNight: r.pricePerNight, quantity: r.quantity, breakfast: r.breakfast, refundable: r.refundable,
    })),
  };
}
