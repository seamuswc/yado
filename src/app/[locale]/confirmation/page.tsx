import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, isLocale, formatDate, formatPrice } from "@/lib/i18n";
import { getBookingByRef } from "@/lib/booking-server";
import { reconcileStripeSession } from "@/lib/payments";
import { canViewBooking } from "@/lib/booking-access";
import { getCurrentUser } from "@/lib/auth";
import { mapsUrl } from "@/lib/hotels";

export default async function ConfirmationPage(props: PageProps<"/[locale]/confirmation">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const sp = await props.searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) ?? "";
  const ref = one("ref");
  let booking = ref ? getBookingByRef(ref) : undefined;
  if (booking && booking.status === "pending_payment" && one("session_id")) {
    await reconcileStripeSession(booking.id, one("session_id"));
    booking = getBookingByRef(ref);
  }
  const user = await getCurrentUser();
  if (booking && !(await canViewBooking(booking, one("session_id")))) booking = undefined;

  if (!booking) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="mb-4">{dict.confirmation.notFound}</p>
        <Link href={`/${locale}`} className="text-primary underline">{dict.confirmation.backHome}</Link>
      </div>
    );
  }
  const name = locale === "ja" ? booking.hotel.nameJa : booking.hotel.nameEn;
  const roomName = booking.room ? (locale === "ja" ? booking.room.nameJa : booking.room.nameEn) : "";
  const pending = booking.status === "pending_payment";

  return (
    <div className="px-4 pt-8">
      <div className="text-center">
        <div className={`mx-auto h-16 w-16 rounded-full flex items-center justify-center text-3xl ${pending ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{pending ? "⏳" : "✓"}</div>
        <h1 className="text-xl font-bold mt-4">{pending ? dict.bookings.pending : dict.confirmation.title}</h1>
        <p className="text-sm text-muted mt-1">{pending ? dict.confirmation.paymentPending : <>{dict.confirmation.subtitle} <span className="font-medium text-ink">{booking.email}</span></>}</p>
      </div>

      <div className="mt-6 rounded-2xl bg-card border border-line p-4">
        <p className="text-xs text-muted">{dict.confirmation.reference}</p>
        <p className="text-2xl font-mono font-bold tracking-wider">{booking.ref}</p>
        <hr className="my-3 border-line" />
        <p className="font-semibold">{name}</p>
        <p className="text-sm text-muted">{roomName}</p>
        <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-muted">{dict.search.checkIn}</dt><dd className="text-right">{formatDate(booking.checkIn, locale)} {booking.hotel.checkInTime}</dd>
          <dt className="text-muted">{dict.search.checkOut}</dt><dd className="text-right">{formatDate(booking.checkOut, locale)} {booking.hotel.checkOutTime}</dd>
          <dt className="text-muted">{dict.search.guests}</dt><dd className="text-right">{booking.guests}{locale === "ja" ? "名" : ""}</dd>
          <dt className="text-muted">{dict.hotel.total}</dt><dd className="text-right font-bold">{formatPrice(booking.total, locale)}</dd>
          <dt className="text-muted">{dict.bookings.status}</dt><dd className="text-right">{dict.bookings[booking.status === "pending_payment" ? "pending" : booking.status]}</dd>
        </dl>
        <p className="mt-3 text-sm text-muted">📍 {locale === "ja" ? booking.hotel.accessJa : booking.hotel.accessEn}</p>
        <a href={mapsUrl({ latitude: booking.hotel.latitude, longitude: booking.hotel.longitude, name: { en: booking.hotel.nameEn, ja: booking.hotel.nameJa }, address: booking.hotel.address }, locale)}
          target="_blank" rel="noopener noreferrer" className="inline-block mt-1 text-sm text-primary underline">{dict.hotel.openMap} ↗</a>
      </div>

      <div className="mt-6 space-y-2">
        <Link href={user ? `/${locale}/bookings` : `/${locale}/login?email=${encodeURIComponent(booking.email)}`} className="block text-center rounded-xl bg-primary text-white font-semibold py-3">{dict.confirmation.viewBookings}</Link>
        <Link href={`/${locale}`} className="block text-center rounded-xl border border-line bg-card py-3">{dict.confirmation.backHome}</Link>
      </div>
    </div>
  );
}
