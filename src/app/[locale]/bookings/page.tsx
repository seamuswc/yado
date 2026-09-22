import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import MagicLinkForm from "@/components/MagicLinkForm";
import ReviewForm from "@/components/ReviewForm";
import { getCurrentUser } from "@/lib/auth";
import { bookingsForGuest } from "@/lib/booking-server";
import { reviewableBookings } from "@/lib/reviews";
import { formatDate, formatPrice, getDictionary, isLocale } from "@/lib/i18n";
import { imgOpts } from "@/lib/images";
import ApiKeyPanel from "@/components/ApiKeyPanel";
import { listOwnedApiKeys } from "@/lib/api-auth";
import { APP_URL } from "@/lib/email";

export default async function BookingsPage(props: PageProps<"/[locale]/bookings">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="px-4 pt-4 space-y-4 md:max-w-xl md:mx-auto">
        <h1 className="text-xl font-bold">{dict.bookings.title}</h1>
        <MagicLinkForm locale={locale} dict={dict} />
      </div>
    );
  }
  if (user.role === "partner") redirect(`/${locale}/partner/bookings`);

  const bookings = bookingsForGuest(user.id, user.email);
  const reviewable = reviewableBookings(user.id, user.email);
  const statusLabel = (s: string) => dict.bookings[(s === "pending_payment" ? "pending" : s) as "pending" | "confirmed" | "cancelled" | "refunded"] ?? s;
  const statusClass = (s: string) => s === "confirmed" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : s === "pending_payment" ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-paper text-muted border-line";

  return (
    <div className="px-4 pt-4 md:max-w-2xl md:mx-auto">
      <h1 className="text-xl font-bold mb-1">{dict.bookings.title}</h1>
      <p className="text-xs text-muted mb-4">{dict.auth.signedInAs} {user.email}</p>
      {user.role === "guest" && (
        <div className="mb-5">
          <ApiKeyPanel
            audience="guest"
            specUrl={`${APP_URL}/api/v1/openapi.json`}
            keys={listOwnedApiKeys(user.id).filter((k) => !k.revokedAt).map((k) => ({ id: k.id, token: k.token, prefix: k.prefix, label: k.label }))}
            copy={dict.api}
          />
        </div>
      )}

      {reviewable.length > 0 && (
        <section className="mb-5 space-y-2">
          <p className="text-sm font-medium">{dict.reviews.eligibleIntro}</p>
          {reviewable.map(({ b, h }) => (
            <ReviewForm key={b.id} locale={locale} dict={dict} bookingId={b.id} hotelName={locale === "ja" ? h.nameJa : h.nameEn} defaultName={`${b.firstName} ${b.lastName.charAt(0)}.`} />
          ))}
        </section>
      )}

      {bookings.length === 0 ? (
        <div className="rounded-2xl bg-card border border-line p-8 text-center">
          <p className="text-4xl mb-3">🏯</p>
          <p className="text-muted mb-4">{dict.bookings.empty}</p>
          <Link href={`/${locale}`} className="inline-block rounded-xl bg-primary text-white font-semibold px-5 py-2.5">{dict.bookings.findStay}</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {bookings.map((b) => (
            <li key={b.id}>
              <Link href={`/${locale}/confirmation?ref=${b.ref}`} className="flex rounded-2xl bg-card border border-line overflow-hidden">
                <div className="relative w-24 shrink-0 bg-line">
                  {b.hotel.images[0] && <Image src={b.hotel.images[0]} alt="" fill sizes="96px" className="object-cover" {...imgOpts(b.hotel.images[0])} />}
                </div>
                <div className="p-3 min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-xs text-muted">{b.ref}</p>
                    <span className={`text-[11px] rounded-full border px-2 py-0.5 ${statusClass(b.status)}`}>{statusLabel(b.status)}</span>
                  </div>
                  <p className="font-semibold leading-snug truncate">{locale === "ja" ? b.hotel.nameJa : b.hotel.nameEn}</p>
                  <p className="text-xs text-muted truncate">{b.room ? (locale === "ja" ? b.room.nameJa : b.room.nameEn) : ""}</p>
                  <p className="text-sm mt-1">{formatDate(b.checkIn, locale)} → {formatDate(b.checkOut, locale)} · {b.guests}{locale === "ja" ? "名" : ""}</p>
                  <p className="text-sm font-semibold">{formatPrice(b.total, locale)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
