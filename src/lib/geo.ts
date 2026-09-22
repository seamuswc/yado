import "server-only";

/**
 * "Near Gion-Shijo" means distance from a point, not a word match. This module turns a place name into
 * coordinates (a built-in table of stations and districts first, OpenStreetMap as a fallback) and measures
 * the distance to each hotel's registered map pin.
 */

export type Point = { latitude: number; longitude: number };

/** Great-circle distance in km. */
export function distanceKm(a: Point, b: Point): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Well-known stations and districts. Names are matched loosely (case, hyphens, "station", 駅 ignored). */
const PLACES: { names: string[]; point: Point }[] = [
  // Tokyo
  { names: ["tokyo station", "東京駅", "tokyo"], point: { latitude: 35.6812, longitude: 139.7671 } },
  { names: ["shinjuku", "新宿"], point: { latitude: 35.6896, longitude: 139.7006 } },
  { names: ["shibuya", "渋谷"], point: { latitude: 35.6580, longitude: 139.7016 } },
  { names: ["ikebukuro", "池袋"], point: { latitude: 35.7295, longitude: 139.7109 } },
  { names: ["ueno", "上野"], point: { latitude: 35.7138, longitude: 139.7770 } },
  { names: ["asakusa", "浅草"], point: { latitude: 35.7119, longitude: 139.7967 } },
  { names: ["akihabara", "秋葉原"], point: { latitude: 35.6984, longitude: 139.7731 } },
  { names: ["ginza", "銀座"], point: { latitude: 35.6717, longitude: 139.7650 } },
  { names: ["shinagawa", "品川"], point: { latitude: 35.6285, longitude: 139.7388 } },
  { names: ["roppongi", "六本木"], point: { latitude: 35.6627, longitude: 139.7313 } },
  { names: ["haneda", "haneda airport", "羽田", "羽田空港"], point: { latitude: 35.5494, longitude: 139.7798 } },
  { names: ["narita", "narita airport", "成田", "成田空港"], point: { latitude: 35.7720, longitude: 140.3929 } },
  // Kyoto
  { names: ["kyoto station", "京都駅", "kyoto"], point: { latitude: 34.9858, longitude: 135.7588 } },
  { names: ["gion", "祇園"], point: { latitude: 35.0037, longitude: 135.7751 } },
  { names: ["gion-shijo", "gion shijo", "祇園四条"], point: { latitude: 35.0037, longitude: 135.7722 } },
  { names: ["kawaramachi", "河原町", "shijo kawaramachi", "四条河原町"], point: { latitude: 35.0038, longitude: 135.7690 } },
  { names: ["arashiyama", "嵐山"], point: { latitude: 35.0094, longitude: 135.6667 } },
  { names: ["fushimi inari", "伏見稲荷"], point: { latitude: 34.9671, longitude: 135.7727 } },
  { names: ["kiyomizu", "kiyomizu-dera", "清水寺"], point: { latitude: 34.9949, longitude: 135.7850 } },
  { names: ["higashiyama", "東山"], point: { latitude: 35.0000, longitude: 135.7800 } },
  { names: ["nijo", "nijo castle", "二条城"], point: { latitude: 35.0142, longitude: 135.7481 } },
  // Osaka
  { names: ["osaka station", "大阪駅", "umeda", "梅田", "osaka"], point: { latitude: 34.7025, longitude: 135.4959 } },
  { names: ["namba", "難波", "なんば"], point: { latitude: 34.6659, longitude: 135.5010 } },
  { names: ["dotonbori", "道頓堀"], point: { latitude: 34.6687, longitude: 135.5013 } },
  { names: ["shin-osaka", "shin osaka", "新大阪"], point: { latitude: 34.7335, longitude: 135.5002 } },
  { names: ["tennoji", "天王寺"], point: { latitude: 34.6465, longitude: 135.5136 } },
  { names: ["universal city", "usj", "ユニバーサルシティ"], point: { latitude: 34.6672, longitude: 135.4362 } },
  { names: ["kansai airport", "kix", "関西空港"], point: { latitude: 34.4320, longitude: 135.2304 } },
  // Others
  { names: ["hakone-yumoto", "hakone yumoto", "箱根湯本", "hakone", "箱根"], point: { latitude: 35.2323, longitude: 139.1055 } },
  { names: ["gora", "強羅"], point: { latitude: 35.2481, longitude: 139.0480 } },
  { names: ["hakata", "博多", "fukuoka", "福岡"], point: { latitude: 33.5902, longitude: 130.4207 } },
  { names: ["tenjin", "天神"], point: { latitude: 33.5914, longitude: 130.3989 } },
  { names: ["sapporo station", "札幌駅", "sapporo", "札幌"], point: { latitude: 43.0686, longitude: 141.3508 } },
  { names: ["susukino", "すすきの"], point: { latitude: 43.0553, longitude: 141.3535 } },
  { names: ["nara station", "奈良駅", "nara", "奈良"], point: { latitude: 34.6817, longitude: 135.8186 } },
  { names: ["nara park", "奈良公園"], point: { latitude: 34.6851, longitude: 135.8430 } },
  { names: ["hiroshima station", "広島駅", "hiroshima", "広島"], point: { latitude: 34.3977, longitude: 132.4754 } },
  { names: ["miyajima", "宮島"], point: { latitude: 34.2960, longitude: 132.3198 } },
  { names: ["naha", "那覇", "okinawa", "沖縄"], point: { latitude: 26.2124, longitude: 127.6809 } },
];

function norm(s: string): string {
  return s.toLowerCase().normalize("NFKC").replace(/\s*(station|sta\.?|駅|eki)\s*$/i, "").replace(/[\s\-‐–_]/g, "").trim();
}

function fromTable(q: string): Point | null {
  const n = norm(q);
  if (!n) return null;
  const exact = PLACES.find((p) => p.names.some((x) => norm(x) === n));
  if (exact) return exact.point;
  // "near Gion in Kyoto" → the most specific known place mentioned
  const hit = PLACES
    .map((p) => ({ p, len: Math.max(...p.names.filter((x) => n.includes(norm(x))).map((x) => norm(x).length), 0) }))
    .filter((x) => x.len >= 3)
    .sort((a, b) => b.len - a.len)[0];
  return hit ? hit.p.point : null;
}

const cache = new Map<string, { point: Point | null; at: number }>();
const DAY = 86_400_000;

/** OpenStreetMap Nominatim, restricted to Japan. Off unless GEOCODE=osm; results are cached for a day. */
async function fromOsm(q: string): Promise<Point | null> {
  if (process.env.GEOCODE !== "osm") return null;
  const key = norm(q);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < DAY) return hit.point;
  let point: Point | null = null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=jp&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { "User-Agent": "Yado/1.0 (hotel search)" }, signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const rows = (await res.json()) as { lat: string; lon: string }[];
      if (rows[0]) point = { latitude: Number(rows[0].lat), longitude: Number(rows[0].lon) };
    }
  } catch { /* offline or slow: fall back to text search */ }
  cache.set(key, { point, at: Date.now() });
  return point;
}

/** Coordinates for a place name, or null when unknown. */
export async function geocode(q: string): Promise<Point | null> {
  const cleaned = q.replace(/^\s*(near|around|close to|by)\s+/i, "").trim();
  if (!cleaned) return null;
  return fromTable(cleaned) ?? (await fromOsm(cleaned));
}
