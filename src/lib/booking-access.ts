import "server-only";
import { cookies } from "next/headers";
import { getCurrentUser } from "./auth";
import type { BookingWithHotel } from "./booking-server";

const COOKIE = "yado_refs";

/** Remember a booking ref in an httpOnly cookie (called from the booking server action). */
export async function rememberBookingRef(ref: string): Promise<void> {
  const store = await cookies();
  const existing = store.get(COOKIE)?.value.split(",").filter(Boolean) ?? [];
  const refs = [ref, ...existing.filter((r) => r !== ref)].slice(0, 20);
  store.set({ name: COOKIE, value: refs.join(","), httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 90 });
}

/** May this request see the booking? Owner session, same verified email, this browser made it, or a matching Stripe session id. */
export async function canViewBooking(b: BookingWithHotel, stripeSessionId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (user && (user.role === "head_admin" || user.id === b.userId || user.email === b.email)) return true;
  const store = await cookies();
  if ((store.get(COOKIE)?.value.split(",") ?? []).includes(b.ref)) return true;
  return !!stripeSessionId && stripeSessionId === b.stripeSessionId;
}
