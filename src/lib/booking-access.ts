import "server-only";
import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getCurrentUser } from "./auth";
import type { BookingWithHotel } from "./booking-server";
import { sha256 } from "./ids";

const COOKIE = "yado_refs";

/** Remember a booking ref in an httpOnly cookie (called from the booking server action). */
export async function rememberBookingRef(ref: string): Promise<void> {
  const store = await cookies();
  const existing = store.get(COOKIE)?.value.split(",").filter(Boolean) ?? [];
  const refs = [ref, ...existing.filter((r) => r !== ref)].slice(0, 20);
  store.set({ name: COOKIE, value: refs.join(","), httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 90 });
}

function hashEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** May this request see the booking? Owner session, same verified email, this browser, a view token, or a matching Stripe session id. */
export async function canViewBooking(b: BookingWithHotel, stripeSessionId: string, viewToken = ""): Promise<boolean> {
  const user = await getCurrentUser();
  if (user && (user.role === "head_admin" || user.id === b.userId || user.email === b.email)) return true;
  const store = await cookies();
  if ((store.get(COOKIE)?.value.split(",") ?? []).includes(b.ref)) return true;
  if (viewToken && b.viewTokenHash && hashEquals(sha256(viewToken), b.viewTokenHash)) return true;
  return !!stripeSessionId && stripeSessionId === b.stripeSessionId;
}
