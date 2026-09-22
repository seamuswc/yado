import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, formatDateLong, formatPrice, getDictionary, isLocale } from "@/lib/i18n";
import { hotelStatusLabel, partnerHotels, toneClass } from "@/lib/partner-server";
import { bookingsForHotels } from "@/lib/booking-server";
import { startFeeCheckout } from "@/actions/partner";
import { reconcileFeeSession } from "@/lib/payments";
import { PARTNER_ANNUAL_FEE, stripeConfigured } from "@/lib/stripe";
import SubmitButton from "@/components/SubmitButton";
import PartnerTabs from "@/components/PartnerTabs";

export default async function PartnerDashboard(props: PageProps<"/[locale]/partner">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  if (!user || user.role !== "partner") redirect(`/${locale}/partner/login`);
  const sp = await props.searchParams;
  let hotels = partnerHotels(user.id);
  if (typeof sp.session_id === "string") {
    await reconcileFeeSession(user.id, sp.session_id);
    hotels = partnerHotels(user.id);
  }
  const P = dict.partner;
  const recent = bookingsForHotels(hotels.map((h) => h.id), 5);
  const stripe = stripeConfigured();

  return (
    <div className="px-4 pt-5 space-y-5">
      <div>
        <h1 className="text-xl font-bold">{P.dashboard}</h1>
        <p className="text-xs text-muted">{dict.auth.signedInAs} {user.email}</p>
      </div>

      <PartnerTabs locale={locale} dict={dict} current="dashboard" />

      {hotels.length === 0 && (
        <div className="rounded-2xl bg-card border border-line p-6 text-center">
          <Link href={`/${locale}/partner/register`} className="text-primary underline">{P.listYourProperty}</Link>
        </div>
      )}

      {hotels.map((h) => {
        const st = hotelStatusLabel(h, dict);
        const needsFee = h.status === "approved" && st.tone !== "ok";
        return (
          <section key={h.id} className="rounded-2xl bg-card border border-line p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold leading-tight">{locale === "ja" ? h.nameJa : h.nameEn}</h2>
                <p className="text-xs text-muted">{h.nameEn !== h.nameJa ? (locale === "ja" ? h.nameEn : h.nameJa) : ""}</p>
              </div>
              <span className={`shrink-0 text-xs rounded-full border px-2 py-0.5 ${toneClass[st.tone]}`}>{st.label}</span>
            </div>
            {h.reviewNote && (h.status === "rejected" || h.status === "suspended") && (
              <div className="text-sm rounded-xl bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2">
                <p><span className="font-medium">{P.reviewNote}:</span> {h.reviewNote}</p>
                {h.status === "rejected" && <p className="text-xs mt-1">{P.resubmitHint}</p>}
              </div>
            )}
            {h.translation === "pending" && <p className="text-xs rounded-lg bg-amber-50 text-amber-800 px-3 py-2">{P.translationPending}</p>}
            {h.paidUntil && <p className="text-sm text-muted">{P.paidUntil}: {formatDateLong(h.paidUntil, locale)}</p>}

            {needsFee && (
              <form action={startFeeCheckout} className="rounded-xl bg-primary-soft p-3 space-y-2">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="hotelId" value={h.id} />
                <p className="font-medium text-primary-dark">{P.feeTitle}</p>
                <p className="text-sm">{P.feeBody.replace("{amount}", formatPrice(PARTNER_ANNUAL_FEE, locale))}</p>
                <SubmitButton className="w-full">{stripe ? `${P.payFee} · ${formatPrice(PARTNER_ANNUAL_FEE, locale)}` : P.demoPay}</SubmitButton>
                {!stripe && <p className="text-xs text-muted">{dict.common.demoMode}</p>}
              </form>
            )}

            <div className="grid grid-cols-2 gap-2 text-sm">
              <Link href={`/${locale}/partner/listing?hotel=${h.id}`} className="rounded-xl border border-line bg-paper py-2.5 text-center font-medium">✏️ {P.editListing}</Link>
              <Link href={`/${locale}/partner/bookings`} className="rounded-xl border border-line bg-paper py-2.5 text-center font-medium">🧾 {P.bookings}</Link>
            </div>
            {st.tone === "ok" && <Link href={`/${locale}/hotels/${h.slug}`} className="block text-xs text-primary underline">→ /{locale}/hotels/{h.slug}</Link>}
          </section>
        );
      })}

      {recent.length > 0 && (
        <section>
          <h2 className="font-semibold mb-2">{P.bookings}</h2>
          <ul className="space-y-2">
            {recent.map((b) => (
              <li key={b.id} className="rounded-xl bg-card border border-line px-3 py-2 text-sm flex justify-between gap-2">
                <span><span className="font-mono text-xs text-muted">{b.ref}</span><br /><span className="text-muted">{formatDate(b.checkIn, locale)} → {formatDate(b.checkOut, locale)}</span></span>
                <span className="text-right font-semibold">{formatPrice(b.total, locale)}<br /><span className="text-xs font-normal text-muted">{dict.bookings[b.status === "pending_payment" ? "pending" : b.status]}</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
