"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser, clientIp, rateLimit } from "@/lib/auth";
import { rememberBookingRef } from "@/lib/booking-access";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n";
import { startGuestBooking } from "@/lib/start-booking";
import { addDays } from "@/lib/dates";
import type { ActionState } from "./auth";

const schemaIn = z.object({
  locale: z.string(),
  hotel: z.string().min(1),
  room: z.string().min(1),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => addDays(s, 0) === s, "invalid date"),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => addDays(s, 0) === s, "invalid date"),
  guests: z.coerce.number().int().min(1).max(8),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z.string().trim().min(5).max(40),
  requests: z.string().trim().max(1000).default(""),
  agree: z.literal("on"),
});

export async function startBooking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale: Locale = isLocale(String(formData.get("locale"))) ? (formData.get("locale") as Locale) : "en";
  const d = getDictionary(locale);
  const parsed = schemaIn.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const f = parsed.error.issues[0]?.path[0];
    if (f === "email") return { error: d.book.invalidEmail };
    if (f === "agree") return { error: d.book.mustAgree };
    return { error: d.book.required };
  }
  const v = parsed.data;
  const ip = await clientIp();
  if (!rateLimit(`book:${ip}`, 20, 10 * 60_000)) return { error: d.auth.rateLimited };

  const user = await getCurrentUser();
  // A signed-in guest always books under their verified email.
  const email = user?.role === "guest" ? user.email : v.email;
  const result = await startGuestBooking({
    locale, hotelSlug: v.hotel, roomId: v.room, checkIn: v.checkIn, checkOut: v.checkOut, guests: v.guests,
    firstName: v.firstName, lastName: v.lastName, email, phone: v.phone, requests: v.requests,
    userId: user?.id ?? null, via: "site",
  });
  if (!result.ok) {
    if (result.error === "notFound" || result.error === "stripe" || result.error === "stripe_not_configured") return { error: d.common.error };
    return { error: d.book.errors[result.error] };
  }
  await rememberBookingRef(result.booking.ref);
  if (result.paymentUrl) redirect(result.paymentUrl);
  redirect(`/${locale}/confirmation?ref=${result.booking.ref}&token=${encodeURIComponent(result.viewToken)}`);
}

