"use client";

import { useRouter, usePathname } from "next/navigation";
import type { Dictionary, Locale } from "@/lib/i18n";
import { addDays } from "@/lib/dates";
import { MAX_GUESTS, type Stay } from "@/lib/stay";

/** Inline check-in / check-out / guests editor used on the hotel page. */
export default function StayBar({ dict, stay, locale, today }: { dict: Dictionary; stay: Stay; locale: Locale; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  function update(next: Partial<Stay>) {
    const s = { ...stay, ...next };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.checkIn)) return;
    if (s.checkIn < today) s.checkIn = today;
    if (s.checkOut <= s.checkIn) s.checkOut = addDays(s.checkIn, 1);
    const p = new URLSearchParams({ checkIn: s.checkIn, checkOut: s.checkOut, guests: String(s.guests) });
    router.replace(`${pathname}?${p}`, { scroll: false });
  }
  const field = "w-full min-w-0 min-h-11 rounded-lg border border-line bg-card px-1.5 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary/40";
  const label = "block text-[11px] text-muted mb-0.5";
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_4.5rem] md:grid-cols-2 gap-1.5 rounded-xl bg-paper border border-line p-2">
      <div>
        <label className={label} htmlFor="sb-in">{dict.search.checkIn}</label>
        <input id="sb-in" type="date" className={field} value={stay.checkIn} min={today} onChange={(e) => update({ checkIn: e.target.value })} />
      </div>
      <div>
        <label className={label} htmlFor="sb-out">{dict.search.checkOut}</label>
        <input id="sb-out" type="date" className={field} value={stay.checkOut} min={addDays(stay.checkIn, 1)} onChange={(e) => update({ checkOut: e.target.value })} />
      </div>
      <div className="md:col-span-2">
        <label className={`${label} whitespace-nowrap`} htmlFor="sb-g">{dict.search.guests}</label>
        <select id="sb-g" className={field} value={stay.guests} onChange={(e) => update({ guests: Number(e.target.value) })}>
          {Array.from({ length: MAX_GUESTS }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}{locale === "ja" ? "名" : ""}</option>)}
        </select>
      </div>
    </div>
  );
}
