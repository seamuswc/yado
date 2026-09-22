import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Dictionary } from "./i18n";
import { isLive } from "./hotels";
import { nowIso } from "./ids";

export function partnerHotels(ownerId: string) {
  return db.select().from(schema.hotels).where(eq(schema.hotels.ownerId, ownerId)).all();
}

export function activeRoomCounts(hotelIds: string[]): Map<string, number> {
  if (!hotelIds.length) return new Map();
  const rows = db.select({ hotelId: schema.rooms.hotelId, n: sql<number>`count(*)` })
    .from(schema.rooms)
    .where(and(inArray(schema.rooms.hotelId, hotelIds), eq(schema.rooms.active, true)))
    .groupBy(schema.rooms.hotelId)
    .all();
  return new Map(rows.map((r) => [r.hotelId, Number(r.n)]));
}

/** Active room types per hotel, for the dashboard card. */
export function activeRoomsByHotel(hotelIds: string[]): Map<string, schema.Room[]> {
  const out = new Map<string, schema.Room[]>();
  if (!hotelIds.length) return out;
  const rows = db.select().from(schema.rooms)
    .where(and(inArray(schema.rooms.hotelId, hotelIds), eq(schema.rooms.active, true)))
    .orderBy(schema.rooms.pricePerNight)
    .all();
  for (const r of rows) out.set(r.hotelId, [...(out.get(r.hotelId) ?? []), r]);
  return out;
}

export function hotelStatusLabel(h: schema.Hotel, d: Dictionary): { label: string; tone: "ok" | "warn" | "bad" | "muted" } {
  if (h.status === "pending") return { label: d.partner.statusPending, tone: "warn" };
  if (h.status === "rejected") return { label: d.partner.statusRejected, tone: "bad" };
  if (h.status === "suspended") return { label: d.partner.statusSuspended, tone: "bad" };
  if (isLive(h)) return { label: d.partner.statusLive, tone: "ok" };
  if (h.paidUntil && h.paidUntil <= nowIso()) return { label: d.partner.statusExpired, tone: "warn" };
  return { label: d.partner.statusApproved, tone: "warn" };
}

export const toneClass: Record<"ok" | "warn" | "bad" | "muted", string> = {
  ok: "bg-emerald-50 text-emerald-800 border-emerald-200",
  warn: "bg-amber-50 text-amber-800 border-amber-200",
  bad: "bg-red-50 text-red-800 border-red-200",
  muted: "bg-paper text-muted border-line",
};
