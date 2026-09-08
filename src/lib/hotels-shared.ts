export type Localized = { en: string; ja: string };

export type AmenityKey =
  | "wifi" | "onsen" | "breakfast" | "parking" | "restaurant" | "bar" | "gym"
  | "spa" | "laundry" | "luggage" | "tatami" | "bath" | "nonSmoking" | "accessible";
export const amenityKeys: AmenityKey[] = ["wifi", "onsen", "breakfast", "parking", "restaurant", "bar", "gym", "spa", "laundry", "luggage", "tatami", "bath", "nonSmoking", "accessible"];

export type City = { id: string; name: Localized; image: string };
const img = (seed: string, w = 800, h = 600) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

export const cities: City[] = [
  { id: "tokyo", name: { en: "Tokyo", ja: "東京" }, image: img("tokyo-city") },
  { id: "kyoto", name: { en: "Kyoto", ja: "京都" }, image: img("kyoto-city") },
  { id: "osaka", name: { en: "Osaka", ja: "大阪" }, image: img("osaka-city") },
  { id: "hakone", name: { en: "Hakone", ja: "箱根" }, image: img("hakone-city") },
  { id: "fukuoka", name: { en: "Fukuoka", ja: "福岡" }, image: img("fukuoka-city") },
  { id: "sapporo", name: { en: "Sapporo", ja: "札幌" }, image: img("sapporo-city") },
  { id: "nara", name: { en: "Nara", ja: "奈良" }, image: img("nara-city") },
  { id: "hiroshima", name: { en: "Hiroshima", ja: "広島" }, image: img("hiroshima-city") },
  { id: "okinawa", name: { en: "Okinawa", ja: "沖縄" }, image: img("okinawa-city") },
  { id: "other", name: { en: "Other", ja: "その他" }, image: img("japan-other") },
];

export const typeLabel: Record<"hotel" | "ryokan" | "business" | "hostel", Localized> = {
  hotel: { en: "Hotel", ja: "ホテル" },
  ryokan: { en: "Ryokan", ja: "旅館" },
  business: { en: "Business hotel", ja: "ビジネスホテル" },
  hostel: { en: "Hostel", ja: "ホステル" },
};
