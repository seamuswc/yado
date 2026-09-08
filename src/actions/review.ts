"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n";
import { addReview, canReview } from "@/lib/reviews";
import { track } from "@/lib/analytics";
import type { ActionState } from "./auth";

const schemaIn = z.object({
  bookingId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().min(1).max(100),
  body: z.string().trim().min(10).max(2000),
  authorName: z.string().trim().min(1).max(40),
});

export async function submitReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale: Locale = isLocale(String(formData.get("locale"))) ? (formData.get("locale") as Locale) : "en";
  const d = getDictionary(locale);
  const user = await requireUser();
  const parsed = schemaIn.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: d.book.required };
  const gate = canReview(parsed.data.bookingId, user.id, user.email);
  if (!gate.ok) return { error: d.reviews.onlyVerified };
  addReview({ booking: gate.booking, userId: user.id, authorName: parsed.data.authorName, rating: parsed.data.rating, title: parsed.data.title, body: parsed.data.body, locale });
  track("review_posted", { locale, meta: { hotel: gate.booking.hotelId, rating: parsed.data.rating } });
  revalidatePath(`/${locale}/bookings`);
  return { ok: true, message: d.reviews.thanks };
}
