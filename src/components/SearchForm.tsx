"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { cities } from "@/lib/hotels-shared";
import { addDays } from "@/lib/dates";

export type StayQuery = { q: string; city: string; checkIn: string; checkOut: string; guests: number };

export default function SearchForm({ locale, dict, initial }: { locale: Locale; dict: Dictionary; initial: StayQuery }) {
  const router = useRouter();
  const [form, setForm] = useState<StayQuery>(initial);
  const set = <K extends keyof StayQuery>(k: K, v: StayQuery[K]) => setForm((f) => ({ ...f, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (form.q) p.set("q", form.q);
    if (form.city) p.set("city", form.city);
    if (form.checkIn) p.set("checkIn", form.checkIn);
    if (form.checkOut) p.set("checkOut", form.checkOut);
    p.set("guests", String(form.guests));
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
          <input id="checkIn" type="date" value={form.checkIn} min={initial.checkIn < form.checkIn ? undefined : initial.checkIn}
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
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor="guests" className={label}>{dict.search.guests}</label>
          <select id="guests" value={form.guests} onChange={(e) => set("guests", Number(e.target.value))} className={field}>
            {[1, 2, 3, 4].map((n) => (
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

