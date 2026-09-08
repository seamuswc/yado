"use client";

import { useActionState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatDate, formatPrice } from "@/lib/i18n";
import type { Stay } from "@/lib/stay";
import { startBooking } from "@/actions/booking";
import SubmitButton from "./SubmitButton";

type Props = {
  locale: Locale;
  dict: Dictionary;
  hotelSlug: string;
  hotelName: string;
  roomId: string;
  roomName: string;
  refundable: boolean;
  stay: Stay;
  nights: number;
  pricePerNight: number;
  stripe: boolean;
  userEmail: string | null;
};

export default function BookingForm(p: Props) {
  const { dict, locale } = p;
  const [state, action] = useActionState(startBooking, {});
  const total = p.pricePerNight * p.nights;
  const field = "w-full rounded-xl border border-line bg-card px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-primary/40";
  const label = "block text-xs font-medium text-muted mb-1";

  const first = (
    <div key="first">
      <label htmlFor="firstName" className={label}>{dict.book.firstName}</label>
      <input id="firstName" name="firstName" required autoComplete="given-name" className={field} />
    </div>
  );
  const last = (
    <div key="last">
      <label htmlFor="lastName" className={label}>{dict.book.lastName}</label>
      <input id="lastName" name="lastName" required autoComplete="family-name" className={field} />
    </div>
  );

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="hotel" value={p.hotelSlug} />
      <input type="hidden" name="room" value={p.roomId} />
      <input type="hidden" name="checkIn" value={p.stay.checkIn} />
      <input type="hidden" name="checkOut" value={p.stay.checkOut} />
      <input type="hidden" name="guests" value={p.stay.guests} />

      <section className="rounded-2xl bg-card border border-line p-4">
        <h2 className="font-semibold mb-1">{p.hotelName}</h2>
        <p className="text-sm text-muted">{p.roomName}</p>
        <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-muted">{dict.search.checkIn}</dt><dd className="text-right font-medium">{formatDate(p.stay.checkIn, locale)}</dd>
          <dt className="text-muted">{dict.search.checkOut}</dt><dd className="text-right font-medium">{formatDate(p.stay.checkOut, locale)}</dd>
          <dt className="text-muted">{dict.search.guests}</dt><dd className="text-right font-medium">{p.stay.guests}{locale === "ja" ? "名" : ""}</dd>
        </dl>
        <p className={`mt-2 text-xs ${p.refundable ? "text-emerald-700" : "text-muted"}`}>{p.refundable ? dict.hotel.freeCancellation : dict.hotel.nonRefundable}</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">{dict.book.guestDetails}</h2>
        <div className="grid grid-cols-2 gap-2">{locale === "ja" ? [last, first] : [first, last]}</div>
        <div>
          <label htmlFor="email" className={label}>{dict.book.email}</label>
          <input id="email" name="email" type="email" required autoComplete="email" inputMode="email" defaultValue={p.userEmail ?? ""} readOnly={!!p.userEmail} className={`${field} ${p.userEmail ? "bg-paper text-muted" : ""}`} />
          <p className="text-xs text-muted mt-1">{p.userEmail ? dict.book.signedInNote.replace("{email}", p.userEmail) : dict.book.guestNote}</p>
        </div>
        <div>
          <label htmlFor="phone" className={label}>{dict.book.phone}</label>
          <input id="phone" name="phone" type="tel" required autoComplete="tel" inputMode="tel" className={field} />
        </div>
        <div>
          <label htmlFor="requests" className={label}>{dict.book.requests}</label>
          <textarea id="requests" name="requests" rows={3} placeholder={dict.book.requestsPlaceholder} className={field} />
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-2">{dict.book.payment}</h2>
        <p className="text-sm rounded-xl bg-primary-soft text-primary-dark px-3 py-2.5">{p.stripe ? dict.book.paymentNote : dict.common.demoMode}</p>
      </section>

      <section className="rounded-2xl bg-card border border-line p-4">
        <h2 className="font-semibold mb-2">{dict.book.summary}</h2>
        <div className="flex justify-between text-sm">
          <span className="text-muted">{formatPrice(p.pricePerNight, locale)} × {p.nights} {p.nights === 1 ? dict.hotel.night : dict.hotel.nights}</span>
          <span>{formatPrice(total, locale)}</span>
        </div>
        <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t border-line">
          <span>{dict.hotel.total}</span><span>{formatPrice(total, locale)}</span>
        </div>
        <p className="text-xs text-muted mt-2">{dict.book.taxNote}</p>
      </section>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="agree" required className="mt-1 h-4 w-4 accent-primary" />
        <span>{dict.book.agree}</span>
      </label>

      {state.error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{state.error}</p>}

      <SubmitButton className="w-full text-base">
        {(p.stripe ? dict.book.payNow : dict.book.confirm)} · {formatPrice(total, locale)}
      </SubmitButton>
    </form>
  );
}
