import { addDays, todayIso } from "@/lib/dates";
import { getLiveHotel } from "@/lib/hotels";
import { nightsBetween } from "@/lib/i18n";
import { apiError, apiJson, limit } from "@/lib/api-http";
import { narrowRooms, presentHotelDetail } from "@/lib/api-present";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const limited = await limit("api:search", 120, 60_000);
  if (limited) return limited;
  const { id } = await ctx.params;
  const hotel = getLiveHotel(id);
  if (!hotel) return apiError(404, "not_found", "No live hotel with that id.");
  const url = new URL(req.url);
  const checkIn = url.searchParams.get("checkIn") ?? "";
  const checkOut = url.searchParams.get("checkOut") ?? "";
  if (checkIn || checkOut) {
    if (!checkIn || !checkOut || addDays(checkIn, 0) !== checkIn || addDays(checkOut, 0) !== checkOut || nightsBetween(checkIn, checkOut) < 1 || checkIn < todayIso()) {
      return apiError(400, "invalid_dates", "checkIn and checkOut must be real YYYY-MM-DD dates, with check-in today or later and check-out after check-in.");
    }
  }
  const guestsRaw = url.searchParams.get("guests");
  const guests = guestsRaw ? Number(guestsRaw) : undefined;
  if (guests != null && (!Number.isInteger(guests) || guests < 1 || guests > 8)) {
    return apiError(400, "invalid_input", "guests must be an integer from 1 to 8.");
  }
  const maxPricePerNight = yenCap(url, "maxPricePerNight");
  if (typeof maxPricePerNight === "string") return apiError(400, "invalid_input", maxPricePerNight);
  const maxTotal = yenCap(url, "maxTotal");
  if (typeof maxTotal === "string") return apiError(400, "invalid_input", maxTotal);
  if (maxTotal != null && !checkIn) return apiError(400, "invalid_input", "maxTotal is the budget for the whole stay. Send checkIn and checkOut with it.");
  const detail = presentHotelDetail(hotel, checkIn || undefined, checkOut || undefined);
  const rooms = narrowRooms(detail.rooms, { guests, maxPricePerNight, maxTotal });
  return apiJson({
    hotel: {
      ...detail,
      rooms,
      minPricePerNightJpy: rooms.length ? Math.min(...rooms.map((r) => r.pricePerNightJpy)) : detail.minPricePerNightJpy,
    },
  });
}

function yenCap(url: URL, name: string): number | null | string {
  const raw = url.searchParams.get(name);
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 5_000_000) return `${name} must be a whole number of yen.`;
  return n;
}
