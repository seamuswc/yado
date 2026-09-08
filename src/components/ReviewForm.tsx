"use client";

import { useActionState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { submitReview } from "@/actions/review";
import SubmitButton from "./SubmitButton";

export default function ReviewForm({ locale, dict, bookingId, hotelName, defaultName }: { locale: Locale; dict: Dictionary; bookingId: string; hotelName: string; defaultName: string }) {
  const [state, action] = useActionState(submitReview, {});
  const field = "w-full rounded-xl border border-line bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
  if (state.ok) return <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">{state.message}</p>;
  return (
    <details className="rounded-xl border border-line bg-paper">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-primary">✍️ {dict.reviews.write}: {hotelName}</summary>
      <form action={action} className="p-3 space-y-2 border-t border-line">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="bookingId" value={bookingId} />
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor={`rating-${bookingId}`} className="text-muted">{dict.reviews.rating}</label>
          <select id={`rating-${bookingId}`} name="rating" defaultValue="5" className="rounded-lg border border-line bg-card px-2 py-1">
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}{"☆".repeat(5 - n)}</option>)}
          </select>
        </div>
        <input name="authorName" defaultValue={defaultName} required maxLength={40} placeholder={dict.reviews.displayName} className={field} />
        <input name="title" required maxLength={100} placeholder={dict.reviews.reviewTitle} className={field} />
        <textarea name="body" required minLength={10} maxLength={2000} rows={3} placeholder={dict.reviews.reviewBody} className={field} />
        {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
        <SubmitButton className="w-full py-2 text-sm">{dict.reviews.submit}</SubmitButton>
      </form>
    </details>
  );
}
