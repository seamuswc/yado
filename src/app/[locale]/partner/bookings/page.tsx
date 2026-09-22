import { notFound, redirect } from "next/navigation";
import PartnerTabs from "@/components/PartnerTabs";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, formatPrice, getDictionary, isLocale } from "@/lib/i18n";
import { partnerHotels } from "@/lib/partner-server";
import { bookingsForHotels } from "@/lib/booking-server";
import { requestInLocale } from "@/lib/reviews";

export default async function PartnerBookings(props: PageProps<"/[locale]/partner/bookings">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  if (!user || user.role !== "partner") redirect(`/${locale}/partner/login`);
  const bookings = bookingsForHotels(partnerHotels(user.id).map((h) => h.id));
  return (
    <div className="px-4 pt-5 space-y-4 md:max-w-2xl md:mx-auto">
      <PartnerTabs locale={locale} dict={dict} current="bookings" />
      <h1 className="text-xl font-bold">{dict.partner.bookings}</h1>
      {bookings.length === 0 ? <p className="text-muted text-sm">{dict.partner.noBookings}</p> : (
        <ul className="space-y-2">
          {bookings.map((b) => (
            <li key={b.id} className="rounded-2xl bg-card border border-line p-3 text-sm">
              <div className="flex justify-between"><span className="font-mono text-xs text-muted">{b.ref}</span><span className="text-xs">{dict.bookings[b.status === "pending_payment" ? "pending" : b.status]}</span></div>
              <p className="font-semibold">{b.guests}{locale === "ja" ? "名" : b.guests === 1 ? " guest" : " guests"}</p>
              <p className="text-muted">{b.room ? (locale === "ja" ? b.room.nameJa : b.room.nameEn) : ""}</p>
              <p>{formatDate(b.checkIn, locale)} → {formatDate(b.checkOut, locale)} · {formatPrice(b.total, locale)}</p>
              <p className="text-muted">{b.email} · {b.phone}</p>
              {requestInLocale(b, locale) && <p className="mt-1 rounded-lg bg-paper px-2 py-1 text-xs">{requestInLocale(b, locale)}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
