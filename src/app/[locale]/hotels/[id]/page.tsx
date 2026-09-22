import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import StayBar from "@/components/StayBar";
import { formatPrice, getDictionary, isLocale, nightsBetween } from "@/lib/i18n";
import { getCity, getHotelForPreview, getLiveHotel, mapsUrl, t, type Hotel } from "@/lib/hotels";
import { getCurrentUser } from "@/lib/auth";
import { reviewsForHotel } from "@/lib/reviews";
import { availabilityForHotel } from "@/lib/booking-server";
import { readStay, stayQuery } from "@/lib/stay";
import { imgOpts } from "@/lib/images";
import { todayIso } from "@/lib/dates";

/** The owner (or an admin) sees a pending listing exactly as guests will, with a banner and no Book buttons. */
async function loadHotel(id: string): Promise<{ hotel: Hotel; preview: boolean } | null> {
  const live = getLiveHotel(id);
  if (live) return { hotel: live, preview: false };
  const found = getHotelForPreview(id);
  if (!found) return null;
  const user = await getCurrentUser();
  const allowed = !!user && (user.role === "head_admin" || (user.role === "partner" && found.row.ownerId === user.id));
  return allowed ? { hotel: found.hotel, preview: true } : null;
}

export async function generateMetadata(props: PageProps<"/[locale]/hotels/[id]">): Promise<Metadata> {
  const { locale, id } = await props.params;
  if (!isLocale(locale)) return {};
  const loaded = await loadHotel(id);
  if (!loaded) return {};
  return { title: t(loaded.hotel.name, locale), description: t(loaded.hotel.description, locale).slice(0, 160) };
}

/** Desktop gallery: one photo wide; two side by side; otherwise one big photo with two or four small ones. */
function galleryShown(n: number): number {
  return n <= 2 ? n : n <= 4 ? 3 : 5;
}
function galleryGrid(n: number): string {
  if (n === 1) return "grid-cols-1 aspect-[3/1]";
  if (n === 2) return "grid-cols-2 aspect-[2.4/1]";
  if (n <= 4) return "grid-cols-3 grid-rows-2 aspect-[2.4/1]";
  return "grid-cols-4 grid-rows-2 aspect-[2.4/1]";
}

export default async function HotelPage(props: PageProps<"/[locale]/hotels/[id]">) {
  const { locale, id } = await props.params;
  if (!isLocale(locale)) notFound();
  const loaded = await loadHotel(id);
  if (!loaded) notFound();
  const { hotel, preview } = loaded;
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
      {preview && (
        <div className="sticky top-14 z-10 bg-amber-100 border-b border-amber-300 text-amber-900 text-sm px-4 py-2 flex items-center justify-between gap-3">
          <span>👁 {dict.hotel.previewBanner}</span>
          <Link href={`/${locale}/partner`} className="shrink-0 underline font-medium">{dict.partner.dashboard}</Link>
        </div>
      )}
      {hotel.images.length === 0 ? (
        <div className="w-full aspect-[4/3] md:aspect-[3/1] md:mt-4 md:mx-4 md:w-auto md:rounded-2xl bg-line flex flex-col items-center justify-center gap-2 text-5xl">
          🏨
          {preview && <Link href={`/${locale}/partner/listing?hotel=${hotel.dbId}`} className="text-sm text-primary underline">{dict.hotel.previewAddPhotos}</Link>}
        </div>
      ) : (
        <>
          {/* Phones: swipe through photos. */}
          <div className="flex gap-1 overflow-x-auto snap-x hide-scrollbar md:hidden">
            {hotel.images.map((src, i) => (
              <div key={`${i}-${src}`} className="relative shrink-0 w-[92%] aspect-[4/3] snap-center bg-line">
                <Image src={src} alt={`${t(hotel.name, locale)} ${i + 1}`} fill sizes="100vw" className="object-cover" priority={i === 0} {...imgOpts(src)} />
              </div>
            ))}
          </div>
          {/* Desktop: one big photo with up to four smaller ones beside it. */}
          <div className={`hidden md:grid mt-4 mx-4 gap-2 rounded-2xl overflow-hidden ${galleryGrid(hotel.images.length)}`}>
            {hotel.images.slice(0, galleryShown(hotel.images.length)).map((src, i, shown) => (
              <div key={`d-${i}-${src}`} className={`relative bg-line ${i === 0 && hotel.images.length >= 3 ? "col-span-2 row-span-2" : ""}`}>
                <Image src={src} alt={`${t(hotel.name, locale)} ${i + 1}`} fill sizes={i === 0 ? "50vw" : "25vw"} className="object-cover" priority={i === 0} {...imgOpts(src)} />
                {i === shown.length - 1 && hotel.images.length > shown.length && <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white font-semibold">+{hotel.images.length - shown.length}</span>}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="px-4 pt-4 md:grid md:grid-cols-[minmax(0,1fr)_22rem] md:gap-x-10 md:items-start">
        <div>
        <Link href={`/${locale}/search?${backQs}`} className="text-sm text-primary">← {dict.hotel.back}</Link>
        <h1 className="text-xl md:text-3xl font-bold mt-2 leading-tight">{t(hotel.name, locale)}</h1>
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
        </div>

        {/* Dates and guests: inline on phones, a sticky side card on desktop. */}
        <div className="mt-4 md:mt-0 md:col-start-2 md:row-start-1 md:row-span-2 md:sticky md:top-20">
          <div className="md:rounded-2xl md:bg-card md:border md:border-line md:p-3">
            <StayBar dict={dict} stay={stay} locale={locale} today={todayIso()} />
            {nights > 0 && hotel.rooms.length > 0 && (
              <p className="hidden md:block text-sm text-muted mt-3">
                {dict.search.from} <span className="font-bold text-ink text-lg">{formatPrice(Math.min(...hotel.rooms.map((r) => r.pricePerNight)), locale)}</span> {dict.search.perNight} · {nights} {nights === 1 ? dict.hotel.night : dict.hotel.nights}
              </p>
            )}
          </div>
        </div>

        <div className="md:col-start-1">
        <section className="mt-6">
          <h2 className="font-semibold mb-2">{dict.hotel.rooms}</h2>
          {hotel.rooms.length === 0 && preview && (
            <p className="text-sm text-muted rounded-xl border border-dashed border-line p-3">
              {dict.hotel.previewNoRooms} <Link href={`/${locale}/partner/listing?hotel=${hotel.dbId}`} className="text-primary underline">{dict.partner.editListing}</Link>
            </p>
          )}
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
                    <div className="relative w-28 md:w-48 shrink-0 bg-line">
                      {room.image ? <Image src={room.image} alt={t(room.name, locale)} fill sizes="(max-width: 768px) 112px, 192px" className="object-cover" {...imgOpts(room.image)} /> : <div className="absolute inset-0 flex items-center justify-center text-2xl">🛏️</div>}
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
                    {preview ? (
                      <span className="inline-block rounded-xl bg-primary/40 text-white text-sm font-semibold px-4 py-2.5 cursor-not-allowed" aria-disabled>{dict.hotel.book}</span>
                    ) : soldOut ? (
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
                  <p className="text-xs text-muted mt-2">
                    {r.authorName} · {dict.reviews.stayedIn} {r.stayMonth}
                    {r.translated && <> · {dict.reviews.translated}</>}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
        </div>
      </div>
    </div>
  );
}
