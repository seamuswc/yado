"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { cities, sortKeys, type SortKey } from "@/lib/hotels-shared";
import { addDays } from "@/lib/dates";
import { MAX_GUESTS } from "@/lib/stay";

export type StayQuery = {
  q: string; city: string; checkIn: string; checkOut: string; guests: number;
  minPrice: string; maxPrice: string; sort: SortKey;
};

export default function SearchForm({ locale, dict, initial, today }: { locale: Locale; dict: Dictionary; initial: StayQuery; today: string }) {
  const router = useRouter();
  const [form, setForm] = useState<StayQuery>(initial);
  const set = <K extends keyof StayQuery>(k: K, v: StayQuery[K]) => setForm((f) => ({ ...f, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const checkIn = form.checkIn < today ? today : form.checkIn;
    const checkOut = form.checkOut > checkIn ? form.checkOut : addDays(checkIn, 1);
    const p = new URLSearchParams();
    if (form.q) p.set("q", form.q);
    if (form.city) p.set("city", form.city);
    if (checkIn) p.set("checkIn", checkIn);
    if (checkOut) p.set("checkOut", checkOut);
    p.set("guests", String(form.guests));
    if (form.minPrice) p.set("minPrice", form.minPrice);
    if (form.maxPrice) p.set("maxPrice", form.maxPrice);
    if (form.sort && form.sort !== "recommended") p.set("sort", form.sort);
    router.push(`/${locale}/search?${p.toString()}`);
  }

  const label = "block text-xs font-medium text-muted mb-1";
  const field = "w-full rounded-xl border border-line bg-card px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <form onSubmit={submit} className="space-y-3">
      {(
        <div>
          <label htmlFor="q" className={label}>{dict.search.destination}</label>
          <div className="flex gap-2">
            <select
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              className={`${field} w-[42%]`}
              aria-label={dict.search.destination}
            >
              <option value="">{dict.search.anywhere}</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>{c.name[locale]}</option>
              ))}
            </select>
            <input
              id="q"
              type="search"
              value={form.q}
              onChange={(e) => set("q", e.target.value)}
              placeholder={dict.search.destinationPlaceholder}
              className={field}
              autoComplete="off"
            />
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="checkIn" className={label}>{dict.search.checkIn}</label>
          <input id="checkIn" type="date" value={form.checkIn} min={today}
            onChange={(e) => {
              const v = e.target.value;
              set("checkIn", v);
              if (form.checkOut <= v) set("checkOut", addDays(v, 1));
            }} className={field} required />
        </div>
        <div>
          <label htmlFor="checkOut" className={label}>{dict.search.checkOut}</label>
          <input id="checkOut" type="date" value={form.checkOut} min={addDays(form.checkIn, 1)}
            onChange={(e) => set("checkOut", e.target.value)} className={field} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="minPrice" className={label}>{dict.search.priceMin}</label>
          <input id="minPrice" inputMode="numeric" value={form.minPrice}
            onChange={(e) => set("minPrice", e.target.value.replace(/[^\d]/g, ""))} className={field} />
        </div>
        <div>
          <label htmlFor="maxPrice" className={label}>{dict.search.priceMax}</label>
          <input id="maxPrice" inputMode="numeric" value={form.maxPrice}
            onChange={(e) => set("maxPrice", e.target.value.replace(/[^\d]/g, ""))} className={field} />
        </div>
      </div>
      <div>
        <label htmlFor="sort" className={label}>{dict.search.sort}</label>
        <select id="sort" value={form.sort} onChange={(e) => set("sort", e.target.value as StayQuery["sort"])} className={field}>
          {sortKeys.map((s) => (
            <option key={s} value={s}>{
              s === "recommended" ? dict.search.sortRecommended
              : s === "priceLow" ? dict.search.sortPriceLow
              : s === "priceHigh" ? dict.search.sortPriceHigh
              : s === "rating" ? dict.search.sortRating
              : s === "size" ? dict.search.sortSize
              : dict.search.sortSizeSmall
            }</option>
          ))}
        </select>
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor="guests" className={label}>{dict.search.guests}</label>
          <select id="guests" value={form.guests} onChange={(e) => set("guests", Number(e.target.value))} className={field}>
            {Array.from({ length: MAX_GUESTS }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n} {n === 1 ? dict.search.guest : dict.search.guestsPlural}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="h-[46px] px-5 rounded-xl bg-primary text-white font-semibold active:bg-primary-dark whitespace-nowrap">
          {dict.search.submit}
        </button>
      </div>
    </form>
  );
}

