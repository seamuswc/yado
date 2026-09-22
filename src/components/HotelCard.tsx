import Image from "next/image";
import Link from "next/link";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatPrice } from "@/lib/i18n";
import { getCity, maxSize, minPrice, t, typeLabel, type Hotel } from "@/lib/hotels";
import { imgOpts } from "@/lib/images";

export default function HotelCard({
  hotel, locale, dict, query,
}: { hotel: Hotel & { distanceKm?: number }; locale: Locale; dict: Dictionary; query?: string }) {
  const city = getCity(hotel.city);
  const href = `/${locale}/hotels/${hotel.id}${query ? `?${query}` : ""}`;
  const size = maxSize(hotel);
  return (
    <Link href={href} className="flex flex-col h-full rounded-2xl bg-card border border-line overflow-hidden shadow-sm hover:shadow-md active:scale-[0.99] transition">
      <div className="relative aspect-[16/10] bg-line">
        {hotel.images[0] && <Image src={hotel.images[0]} alt={t(hotel.name, locale)} fill sizes="(max-width: 768px) 100vw, 400px" className="object-cover" {...imgOpts(hotel.images[0])} />}
        <span className="absolute top-2 left-2 text-[11px] font-medium bg-white/90 rounded-full px-2 py-0.5">
          {t(typeLabel[hotel.type], locale)}
        </span>
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-snug">{t(hotel.name, locale)}</h3>
          {hotel.reviewCount > 0 && <span className="shrink-0 text-sm font-semibold text-accent">★ {hotel.rating.toFixed(1)}</span>}
        </div>
        <p className="text-sm text-muted mt-0.5">
          {city ? t(city.name, locale) : ""}{hotel.station.en || hotel.station.ja ? ` · 🚉 ${t(hotel.station, locale)}` : hotel.area.en ? ` · ${t(hotel.area, locale)}` : ""}
          {hotel.distanceKm != null && <span className="ml-1 text-ink">· {dict.search.distanceAway.replace("{km}", hotel.distanceKm < 1 ? `${Math.round(hotel.distanceKm * 1000)} m` : `${hotel.distanceKm} km`)}</span>}
        </p>
        <p className="mt-auto pt-2 text-sm flex items-baseline justify-between">
          <span>
            <span className="text-muted">{dict.search.from} </span>
            <span className="text-lg font-bold">{formatPrice(minPrice(hotel), locale)}</span>
            <span className="text-muted"> {dict.search.perNight}</span>
          </span>
          {size > 0 && <span className="text-xs text-muted">↔ {size} {dict.hotel.size}</span>}
        </p>
      </div>
    </Link>
  );
}
