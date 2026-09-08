import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import SearchForm from "@/components/SearchForm";
import HotelCard from "@/components/HotelCard";
import { formatDate, getDictionary, isLocale } from "@/lib/i18n";
import { getCity, searchHotels, sortKeys, t, type SearchParams } from "@/lib/hotels";
import { readStay, stayQuery } from "@/lib/stay";
import { track } from "@/lib/analytics";
import { todayIso } from "@/lib/dates";

export default async function SearchPage(props: PageProps<"/[locale]/search">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const sp = await props.searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) ?? "";
  const stay = readStay(sp);
  const q = one("q").slice(0, 80);
  const city = getCity(one("city"))?.id ?? "";
  const sort = (sortKeys.includes(one("sort") as never) ? one("sort") : "recommended") as NonNullable<SearchParams["sort"]>;
  const results = searchHotels({ q, city, guests: stay.guests, sort });
  after(() => track("search", { locale, meta: { q, city, guests: stay.guests, sort, results: results.length } }));

  const base = new URLSearchParams();
  if (q) base.set("q", q);
  if (city) base.set("city", city);
  for (const [k, v] of new URLSearchParams(stayQuery(stay))) base.set(k, v);

  const sortLabel: Record<NonNullable<SearchParams["sort"]>, string> = {
    recommended: dict.search.sortRecommended,
    priceLow: dict.search.sortPriceLow,
    priceHigh: dict.search.sortPriceHigh,
    rating: dict.search.sortRating,
    size: dict.search.sortSize,
  };

  return (
    <div>
      <div className="px-4 pt-3 pb-2 bg-card border-b border-line">
        <details className="group">
          <summary className="list-none cursor-pointer flex items-center justify-between text-sm">
            <span>
              <span className="font-semibold">{city ? t(getCity(city)!.name, locale) : q || dict.search.anywhere}</span>
              <span className="text-muted"> · {formatDate(stay.checkIn, locale)} → {formatDate(stay.checkOut, locale)} · {stay.guests}{locale === "ja" ? "名" : ` ${stay.guests === 1 ? dict.search.guest : dict.search.guestsPlural}`}</span>
            </span>
            <span className="text-primary group-open:rotate-180 transition">▾</span>
          </summary>
          <div className="pt-3">
            <SearchForm locale={locale} dict={dict} initial={{ q, city, ...stay }} today={todayIso()} />
          </div>
        </details>
      </div>

      <div className="flex gap-2 overflow-x-auto px-4 py-3 hide-scrollbar">
        {sortKeys.map((s) => {
          const p = new URLSearchParams(base);
          p.set("sort", s);
          const active = s === sort;
          return (
            <Link key={s} href={`/${locale}/search?${p}`} scroll={false}
              className={`shrink-0 text-sm px-3 py-2 min-h-10 inline-flex items-center rounded-full border ${active ? "bg-ink text-white border-ink" : "bg-card border-line text-ink"}`}>
              {sortLabel[s]}
            </Link>
          );
        })}
      </div>

      <p className="px-4 pb-2 text-sm text-muted">{results.length} {results.length === 1 ? dict.search.resultOne : dict.search.results}</p>
      <div className="px-4 space-y-3">
        {results.length === 0 && (
          <p className="rounded-xl bg-card border border-line p-6 text-center text-muted">{dict.search.noResults}</p>
        )}
        {results.map((h) => (
          <HotelCard key={h.id} hotel={h} locale={locale} dict={dict} query={stayQuery(stay)} />
        ))}
      </div>
    </div>
  );
}
