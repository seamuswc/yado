import { addDays, todayIso } from "@/lib/dates";
import { searchHotels, sortKeys, type SearchParams } from "@/lib/hotels";
import { cities } from "@/lib/hotels-shared";
import { geocode } from "@/lib/geo";
import { nightsBetween } from "@/lib/i18n";
import { MAX_GUESTS } from "@/lib/stay";
import { apiError, apiJson, limit } from "@/lib/api-http";
import { narrowRooms, presentHotelSummary } from "@/lib/api-present";

export const dynamic = "force-dynamic";

function stay(url: URL): { checkIn?: string; checkOut?: string; error?: string } {
  const checkIn = url.searchParams.get("checkIn") ?? "";
  const checkOut = url.searchParams.get("checkOut") ?? "";
  if (!checkIn && !checkOut) return {};
  if (!checkIn || !checkOut || addDays(checkIn, 0) !== checkIn || addDays(checkOut, 0) !== checkOut) {
    return { error: "checkIn and checkOut must both be real dates in YYYY-MM-DD form." };
  }
  if (nightsBetween(checkIn, checkOut) < 1 || checkIn < todayIso()) {
    return { error: "checkIn must be today or later in Japan, and checkOut must be after checkIn." };
  }
  return { checkIn, checkOut };
}

export async function GET(req: Request) {
  const limited = await limit("api:search", 120, 60_000);
  if (limited) return limited;
  const url = new URL(req.url);
  const dates = stay(url);
  if (dates.error) return apiError(400, "invalid_dates", dates.error);
  const city = url.searchParams.get("city") ?? "";
  if (city && !cities.some((c) => c.id === city)) return apiError(400, "invalid_input", "Unknown city. Use an id from GET /api/v1/cities.");
  const minPricePerNight = yenParam(url, "minPricePerNight");
  if (typeof minPricePerNight === "string") return apiError(400, "invalid_input", minPricePerNight);
  const maxPricePerNight = yenParam(url, "maxPricePerNight");
  if (typeof maxPricePerNight === "string") return apiError(400, "invalid_input", maxPricePerNight);
  const maxTotal = yenParam(url, "maxTotal");
  if (typeof maxTotal === "string") return apiError(400, "invalid_input", maxTotal);
  if (maxTotal != null && !dates.checkIn) return apiError(400, "invalid_input", "maxTotal is the budget for the whole stay. Send checkIn and checkOut with it.");
  const guests = Number(url.searchParams.get("guests") ?? "1");
  if (!Number.isInteger(guests) || guests < 1 || guests > MAX_GUESTS) return apiError(400, "invalid_input", `guests must be an integer from 1 to ${MAX_GUESTS}.`);
  const sortParam = url.searchParams.get("sort") ?? "recommended";
  const sort = (sortKeys as readonly string[]).includes(sortParam) ? sortParam as NonNullable<SearchParams["sort"]> : null;
  if (!sort) return apiError(400, "invalid_input", "sort must be recommended, priceLow, priceHigh, rating, size, or sizeSmall.");

  const q = url.searchParams.get("q") || url.searchParams.get("near") || "";
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const radiusRaw = url.searchParams.get("radiusKm");
  const radiusKm = radiusRaw ? Number(radiusRaw) : undefined;
  if (radiusKm != null && (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 100)) return apiError(400, "invalid_input", "radiusKm must be between 0 and 100.");
  const point = Number.isFinite(lat) && Number.isFinite(lng) && url.searchParams.has("lat") && url.searchParams.has("lng")
    ? { latitude: lat, longitude: lng }
    : q ? await geocode(q) : null;
  const hotels = searchHotels({ q, city, guests, sort, minPrice: minPricePerNight ?? undefined, maxPrice: maxPricePerNight ?? undefined, point: point ?? undefined, radiusKm })
    .map((h) => {
      const summary = presentHotelSummary(h, dates.checkIn, dates.checkOut);
      const rooms = narrowRooms(summary.rooms, { guests, maxPricePerNight, maxTotal });
      return {
        ...summary,
        distanceKm: h.distanceKm ?? null,
        rooms,
        minPricePerNightJpy: rooms.length ? Math.min(...rooms.map((r) => r.pricePerNightJpy)) : summary.minPricePerNightJpy,
      };
    })
    .filter((h) => h.rooms.length > 0)
    .slice(0, 20);

  return apiJson({
    checkIn: dates.checkIn ?? null,
    checkOut: dates.checkOut ?? null,
    guests,
    near: q || null,
    nearPoint: point,
    radiusKm: point ? (radiusKm ?? 5) : null,
    minPricePerNight,
    maxPricePerNight,
    maxTotal,
    hotels,
  });
}

/** Whole yen, or an error string. Empty means no limit. */
function yenParam(url: URL, name: string): number | null | string {
  const raw = url.searchParams.get(name);
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 5_000_000) return `${name} must be a whole number of yen.`;
  return n;
}
