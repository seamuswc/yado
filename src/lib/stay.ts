import { addDays, todayIso } from "@/lib/dates";

export type Stay = { checkIn: string; checkOut: string; guests: number };

/** Matches the booking form and the assistant API. */
export const MAX_GUESTS = 8;

/** Read stay dates/guests from URL search params, filling sensible defaults. */
export function readStay(sp: Record<string, string | string[] | undefined>): Stay {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) ?? "";
  const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && addDays(s, 0) === s;
  let checkIn = isDate(one("checkIn")) ? one("checkIn") : "";
  let checkOut = isDate(one("checkOut")) ? one("checkOut") : "";
  const today = todayIso();
  if (!checkIn) checkIn = addDays(today, 7);
  if (checkIn < today) checkIn = today;
  if (!checkOut || checkOut <= checkIn) checkOut = addDays(checkIn, 2);
  const g = Number(one("guests"));
  const guests = Number.isFinite(g) && g >= 1 && g <= MAX_GUESTS ? Math.floor(g) : 2;
  return { checkIn, checkOut, guests };
}

export function stayQuery(stay: Stay): string {
  const p = new URLSearchParams();
  if (stay.checkIn) p.set("checkIn", stay.checkIn);
  if (stay.checkOut) p.set("checkOut", stay.checkOut);
  p.set("guests", String(stay.guests));
  return p.toString();
}
