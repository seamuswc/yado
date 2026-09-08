import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import StayBar from "@/components/StayBar";
import { formatPrice, getDictionary, isLocale, nightsBetween } from "@/lib/i18n";
import { getCity, getLiveHotel, mapsUrl, t } from "@/lib/hotels";
import { reviewsForHotel } from "@/lib/reviews";
import { availabilityForHotel } from "@/lib/booking-server";
import { readStay, stayQuery } from "@/lib/stay";
import { imgOpts } from "@/lib/images";
import { todayIso } from "@/lib/dates";

export async function generateMetadata(props: PageProps<"/[locale]/hotels/[id]">): Promise<Metadata> {
  const { locale, id } = await props.params;
  const hotel = getLiveHotel(id);
  if (!hotel || !isLocale(locale)) return {};
  return { title: t(hotel.name, locale), description: t(hotel.description, locale).slice(0, 160) };
}

export default async function HotelPage(props: PageProps<"/[locale]/hotels/[id]">) {
  const { locale, id } = await props.params;
  if (!isLocale(locale)) notFound();
  const hotel = getLiveHotel(id);
  if (!hotel) notFound();
  const dict = getDictionary(locale);
  const sp = await props.searchParams;
  const stay = readStay(sp);
  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  const city = getCity(hotel.city);
  const backQs = new URLSearchParams(stayQuery(stay));
  backQs.set("city", hotel.city);
  const reviews = reviewsForHotel(hotel.dbId, locale, 10);
  const availability = nights > 0 ? availabilityForHotel(hotel.dbId, stay.checkIn, stay.checkOut) : new Map<string, number>();
  const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto snap-x hide-scrollbar">
        {hotel.images.map((src, i) => (
          <div key={`${i}-${src}`} className="relative shrink-0 w-[92%] aspect-[4/3] snap-center bg-line">
            <Image src={src} alt={`${t(hotel.name, locale)} ${i + 1}`} fill sizes="448px" className="object-cover" priority={i === 0} {...imgOpts(src)} />
          </div>
        ))}
        {hotel.images.length === 0 && <div className="w-full aspect-[4/3] bg-line flex items-center justify-center text-5xl">🏨</div>}
      </div>

      <div className="px-4 pt-4">
        <Link href={`/${locale}/search?${backQs}`} className="text-sm text-primary">← {dict.hotel.back}</Link>
        <h1 className="text-xl font-bold mt-2 leading-tight">{t(hotel.name, locale)}</h1>
        <p className="text-sm text-muted mt-1">
          {city ? t(city.name, locale) : ""}{hotel.area.en || hotel.area.ja ? ` · ${t(hotel.area, locale)}` : ""}
        </p>
        <p className="text-sm mt-1">
          {hotel.reviewCount > 0 ? (
            <><span className="font-semibold text-accent">★ {hotel.rating.toFixed(1)}</span>
            <span className="text-muted"> · {hotel.reviewCount.toLocaleString(locale === "ja" ? "ja-JP" : "en-US")} {hotel.reviewCount === 1 ? dict.hotel.reviewOne : dict.hotel.reviews}</span></>
          ) : <span className="text-muted">{dict.reviews.noReviews}</span>}
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          {(hotel.station.en || hotel.station.ja) && <span className="rounded-full bg-card border border-line px-2.5 py-1">🚉 {t(hotel.station, locale)}</span>}
          <a href={mapsUrl(hotel, locale)} target="_blank" rel="noopener noreferrer" className="rounded-full bg-card border border-line px-2.5 py-1 text-primary">📍 {dict.hotel.openMap} ↗</a>
        </div>

        <div className="mt-4">
          <StayBar dict={dict} stay={stay} locale={locale} today={todayIso()} />
        </div>

        <section className="mt-6">
          <h2 className="font-semibold mb-2">{dict.hotel.rooms}</h2>
          <div className="space-y-3">
            {hotel.rooms.map((room) => {
              const fits = room.sleeps >= stay.guests;
              const left = availability.get(room.id);
              const soldOut = left !== undefined && left < 1;
              const total = room.pricePerNight * nights;
              const p = new URLSearchParams(stayQuery(stay));
              p.set("hotel", hotel.id);
              p.set("room", room.id);
              return (
                <article key={room.id} className={`rounded-2xl bg-card border border-line overflow-hidden ${fits && !soldOut ? "" : "opacity-60"}`}>
                  <div className="flex">
                    <div className="relative w-28 shrink-0 bg-line">
                      {room.image ? <Image src={room.image} alt={t(room.name, locale)} fill sizes="112px" className="object-cover" {...imgOpts(room.image)} /> : <div className="absolute inset-0 flex items-center justify-center text-2xl">🛏️</div>}
                    </div>
                    <div className="p-3 flex-1 min-w-0">
                      <h3 className="font-semibold leading-snug">{t(room.name, locale)}</h3>
                      <p className="text-xs text-muted mt-0.5">{t(room.description, locale)}</p>
                      <ul className="flex flex-wrap gap-1 mt-2 text-[11px]">
                        <li className="rounded-full bg-paper border border-line px-2 py-0.5">{dict.hotel.sleeps} {room.sleeps}</li>
                        {room.sizeSqm ? <li className="rounded-full bg-paper border border-line px-2 py-0.5">{room.sizeSqm} {dict.hotel.size}</li> : null}
                        <li className="rounded-full bg-paper border border-line px-2 py-0.5">{room.breakfast ? dict.hotel.breakfastIncluded : dict.hotel.breakfastNot}</li>
                        <li className={`rounded-full px-2 py-0.5 border ${room.refundable ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-paper border-line text-muted"}`}>
                          {room.refundable ? dict.hotel.freeCancellation : dict.hotel.nonRefundable}
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-line px-3 py-2.5">
                    <div>
                      <p className="text-lg font-bold leading-none">{formatPrice(room.pricePerNight, locale)} <span className="text-xs font-normal text-muted">{dict.search.perNight}</span></p>
                      {nights > 0 && (
                        <p className="text-xs text-muted mt-1">{dict.hotel.total}: {formatPrice(total, locale)} · {nights} {nights === 1 ? dict.hotel.night : dict.hotel.nights}</p>
                      )}
                    </div>
                    {soldOut ? (
                      <span className="text-xs font-medium text-muted">{dict.hotel.soldOut}</span>
                    ) : fits ? (
                      <div className="text-right">
                        <Link href={`/${locale}/book?${p}`} className="inline-block rounded-xl bg-primary text-white text-sm font-semibold px-4 py-2.5 active:bg-primary-dark">
                          {dict.hotel.book}
                        </Link>
                        {left !== undefined && left <= 2 && <p className="text-[11px] text-primary mt-1">{locale === "ja" ? `残り${left}室` : `${left} ${dict.hotel.left}`}</p>}
                      </div>
                    ) : (
                      <span className="text-xs text-muted">{dict.hotel.sleeps} {room.sleeps}</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="font-semibold mb-2">{dict.hotel.about}</h2>
          <p className="text-sm leading-relaxed whitespace-pre-line">{t(hotel.description, locale)}</p>
          <p className="text-sm text-muted mt-2">
            {dict.hotel.checkInTime} {hotel.checkIn} · {dict.hotel.checkOutTime} {hotel.checkOut}
          </p>
        </section>

        {hotel.amenities.length > 0 && (
          <section className="mt-6">
            <h2 className="font-semibold mb-2">{dict.hotel.amenities}</h2>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
              {hotel.amenities.map((a) => (
                <li key={a} className="flex items-center gap-1.5"><span className="text-accent">✓</span>{dict.amenities[a]}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-6">
          <h2 className="font-semibold mb-2">{dict.hotel.location}</h2>
          {(hotel.station.en || hotel.station.ja) && <p className="text-sm">🚉 {dict.hotel.station}: {t(hotel.station, locale)}</p>}
          {hotel.access.en || hotel.access.ja ? <p className="text-sm mt-1">{t(hotel.access, locale)}</p> : null}
          {hotel.address && <p className="text-sm text-muted mt-1">{hotel.address}</p>}
          <a href={mapsUrl(hotel, locale)} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-sm text-primary underline">{dict.hotel.openMap} ↗</a>
        </section>

        <section className="mt-6 mb-4">
          <h2 className="font-semibold mb-2">{dict.reviews.title}</h2>
          {reviews.length === 0 ? (
            <p className="text-sm text-muted">{dict.reviews.noReviews}</p>
          ) : (
            <ul className="space-y-3">
              {reviews.map((r) => (
                <li key={r.id} className="rounded-2xl bg-card border border-line p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-accent text-sm tracking-tight">{stars(r.rating)}</span>
                    <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">✓ {dict.reviews.verifiedStay}</span>
                  </div>
                  {r.title && <p className="font-medium mt-1">{r.title}</p>}
                  <p className="text-sm mt-1 whitespace-pre-line">{r.body}</p>
                  <p className="text-xs text-muted mt-2">{r.authorName} · {dict.reviews.stayedIn} {r.stayMonth}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
