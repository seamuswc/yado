import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { imgOpts } from "@/lib/images";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, formatDateLong, formatPrice, getDictionary, isLocale, type Locale } from "@/lib/i18n";
import { activeRoomsByHotel, hotelStatusLabel, partnerHotels, toneClass } from "@/lib/partner-server";
import { bookingsForHotels } from "@/lib/booking-server";
import { startFeeCheckout } from "@/actions/partner";
import { reconcileFeeSession } from "@/lib/payments";
import { PARTNER_ANNUAL_FEE, demoPaymentsAllowed, stripeConfigured } from "@/lib/stripe";
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
  const roomsByHotel = activeRoomsByHotel(hotels.map((h) => h.id));
  const recent = bookingsForHotels(hotels.map((h) => h.id), 5);
  const stripe = stripeConfigured();
  const allowDemo = demoPaymentsAllowed();
  const notice = typeof sp.error === "string" ? sp.error : Array.isArray(sp.error) ? sp.error[0] : "";
  const live = hotels.filter((h) => hotelStatusLabel(h, dict).tone === "ok");
  const pending = hotels.filter((h) => h.status === "pending");
  const attention = hotels.filter((h) => !live.includes(h) && !pending.includes(h));
  const groups = [
    { key: "pending", title: P.pendingListings, items: pending },
    { key: "attention", title: P.needsAttention, items: attention },
    { key: "live", title: P.liveListings, items: live },
  ];

  return (
    <div className="px-4 pt-5 space-y-5">
      <div>
        <h1 className="text-xl font-bold">{P.dashboard}</h1>
        <p className="text-xs text-muted">{dict.auth.signedInAs} {user.email}</p>
      </div>

      <PartnerTabs locale={locale} dict={dict} current="dashboard" />

      {notice === "payments" && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{dict.common.paymentsUnavailable}</p>}

      {hotels.length === 0 && (
        <div className="rounded-2xl bg-card border border-line p-6 text-center">
          <Link href={`/${locale}/partner/register`} className="text-primary underline">{P.listYourProperty}</Link>
        </div>
      )}

      {groups.map(({ key, title, items }) => items.length > 0 && (
        <div key={key} className="space-y-3">
          <h2 className="font-semibold flex items-center gap-2">{title}<span className="text-xs font-medium rounded-full bg-paper border border-line px-2 py-0.5">{items.length}</span></h2>
          <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start">
            {items.map((h) => card(h, locale))}
          </div>
        </div>
      ))}

      {recent.length > 0 && (
        <section className="md:max-w-2xl">
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

  function card(h: (typeof hotels)[number], lc: Locale) {
        const st = hotelStatusLabel(h, dict);
        const needsFee = h.status === "approved" && st.tone !== "ok";
        const rooms = roomsByHotel.get(h.id) ?? [];
        const showSteps = st.tone !== "ok" && h.status !== "rejected" && h.status !== "suspended";
        return (
          <section key={h.id} className="rounded-2xl bg-card border border-line p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold leading-tight">{lc === "ja" ? h.nameJa : h.nameEn}</h2>
                <p className="text-xs text-muted">{h.nameEn !== h.nameJa ? (lc === "ja" ? h.nameEn : h.nameJa) : ""}</p>
              </div>
              <span className={`shrink-0 text-xs rounded-full border px-2 py-0.5 ${toneClass[st.tone]}`}>{st.label}</span>
            </div>
            {h.images.length > 0 ? (
              <Link href={`/${lc}/hotels/${h.slug}`} className="flex gap-1.5 overflow-x-auto hide-scrollbar -mx-1 px-1">
                {h.images.slice(0, 6).map((src, i) => (
                  <span key={`${i}-${src}`} className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-line">
                    <Image src={src} alt="" fill sizes="112px" className="object-cover" {...imgOpts(src)} />
                  </span>
                ))}
                {h.images.length > 6 && <span className="flex h-20 w-16 shrink-0 items-center justify-center rounded-lg bg-paper border border-line text-xs text-muted">+{h.images.length - 6}</span>}
              </Link>
            ) : (
              <Link href={`/${lc}/partner/listing?hotel=${h.id}`} className="flex h-20 items-center justify-center gap-2 rounded-lg border border-dashed border-line text-sm text-muted">
                📷 {P.noPhotosYet}
              </Link>
            )}
            {h.descriptionJa && <p className="text-sm leading-relaxed whitespace-pre-line">{lc === "ja" ? h.descriptionJa : h.descriptionEn || h.descriptionJa}</p>}
            <p className="text-xs text-muted">
              {[
                (lc === "ja" ? h.stationJa : h.stationEn) && `🚉 ${lc === "ja" ? h.stationJa : h.stationEn || h.stationJa}`,
                `${dict.hotel.checkInTime} ${h.checkInTime} · ${dict.hotel.checkOutTime} ${h.checkOutTime}`,
                h.amenities.length > 0 && h.amenities.map((a) => dict.amenities[a as keyof typeof dict.amenities]).filter(Boolean).join(" · "),
              ].filter(Boolean).join("  |  ")}
            </p>
            {h.reviewNote && (h.status === "rejected" || h.status === "suspended") && (
              <div className="text-sm rounded-xl bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2">
                <p><span className="font-medium">{P.reviewNote}:</span> {h.reviewNote}</p>
                {h.status === "rejected" && <p className="text-xs mt-1">{P.resubmitHint}</p>}
              </div>
            )}
            {showSteps && (
              <ol className="rounded-xl border border-line bg-paper p-3 space-y-1.5 text-sm">
                {[
                  { done: !!user!.emailVerifiedAt, label: P.stepEmail },
                  { done: rooms.length > 0, label: P.stepRooms, href: `/${lc}/partner/listing?hotel=${h.id}`, alt: { label: P.apiTab, href: `/${lc}/partner/api` } },
                  { done: h.status === "approved", label: P.stepReview },
                  { done: false, label: P.stepFee },
                ].map((s, i, arr) => {
                  const current = !s.done && arr.slice(0, i).every((x) => x.done);
                  return (
                    <li key={s.label} className={`flex items-start gap-2 ${s.done ? "text-muted" : current ? "font-medium" : "text-muted"}`}>
                      <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${s.done ? "bg-emerald-600 text-white" : current ? "bg-primary text-white" : "border border-line"}`}>{s.done ? "✓" : i + 1}</span>
                      <span>
                        {s.label}
                        {current && s.href && <> · <Link href={s.href} className="text-primary underline">{P.editListing}</Link>{s.alt && <> / <Link href={s.alt.href} className="text-primary underline">{s.alt.label}</Link></>}</>}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
            {rooms.length === 0 ? (
              !showSteps && <p className="text-sm text-muted">{P.fillPending}</p>
            ) : (
              <div>
                <p className="text-xs font-medium text-muted mb-1">{P.roomTypes} · {rooms.length}</p>
                <div className="space-y-2">
                  {rooms.map((r) => {
                    const name = (lc === "ja" ? r.nameJa : r.nameEn) || r.nameJa;
                    const desc = (lc === "ja" ? r.descriptionJa : r.descriptionEn) || r.descriptionJa;
                    const photo = r.image || h.images[0];
                    return (
                      <article key={r.id} className="rounded-xl border border-line bg-paper overflow-hidden">
                        <div className="flex">
                          <div className="relative w-24 shrink-0 bg-line">
                            {photo ? <Image src={photo} alt="" fill sizes="96px" className="object-cover" {...imgOpts(photo)} /> : <div className="absolute inset-0 flex items-center justify-center text-2xl">🛏️</div>}
                          </div>
                          <div className="p-3 flex-1 min-w-0">
                            <h3 className="font-semibold leading-snug">{name}</h3>
                            {desc && <p className="text-xs text-muted mt-0.5">{desc}</p>}
                            <ul className="flex flex-wrap gap-1 mt-2 text-[11px]">
                              <li className="rounded-full bg-card border border-line px-2 py-0.5">{dict.hotel.sleeps} {r.sleeps}</li>
                              {r.sizeSqm ? <li className="rounded-full bg-card border border-line px-2 py-0.5">{r.sizeSqm} {dict.hotel.size}</li> : null}
                              <li className="rounded-full bg-card border border-line px-2 py-0.5">{r.breakfast ? dict.hotel.breakfastIncluded : dict.hotel.breakfastNot}</li>
                              <li className={`rounded-full px-2 py-0.5 border ${r.refundable ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-card border-line text-muted"}`}>{r.refundable ? dict.hotel.freeCancellation : dict.hotel.nonRefundable}</li>
                              <li className="rounded-full bg-card border border-line px-2 py-0.5">×{r.quantity}</li>
                            </ul>
                          </div>
                        </div>
                        <div className="flex items-center justify-between border-t border-line px-3 py-2">
                          <p className="font-bold leading-none">{formatPrice(r.pricePerNight, lc)} <span className="text-xs font-normal text-muted">{dict.search.perNight}</span></p>
                          <Link href={`/${lc}/partner/listing?hotel=${h.id}`} className="text-xs text-primary underline">✏️ {P.editListing}</Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
            {h.status === "pending" && rooms.length > 0 && <p className="text-sm rounded-xl bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2">{P.reviewThenFee.replace("{amount}", formatPrice(PARTNER_ANNUAL_FEE, lc))}</p>}
            {h.translation === "pending" && h.descriptionJa && <p className="text-xs rounded-lg bg-amber-50 text-amber-800 px-3 py-2">{P.translationPending}</p>}
            {h.paidUntil && <p className="text-sm text-muted">{P.paidUntil}: {formatDateLong(h.paidUntil, lc)}</p>}

            {needsFee && (
              <form action={startFeeCheckout} className="rounded-xl bg-primary-soft p-3 space-y-2">
                <input type="hidden" name="locale" value={lc} />
                <input type="hidden" name="hotelId" value={h.id} />
                <p className="font-medium text-primary-dark">{P.feeTitle}</p>
                <p className="text-sm">{P.feeBody.replace("{amount}", formatPrice(PARTNER_ANNUAL_FEE, lc))}</p>
                {stripe || allowDemo ? (
                  <>
                    <SubmitButton className="w-full">{stripe ? `${P.payFee} · ${formatPrice(PARTNER_ANNUAL_FEE, lc)}` : P.demoPay}</SubmitButton>
                    {!stripe && <p className="text-xs text-muted">{dict.common.demoMode}</p>}
                  </>
                ) : (
                  <p className="text-sm">{dict.common.paymentsUnavailable}</p>
                )}
              </form>
            )}

            <Link href={`/${lc}/hotels/${h.slug}`} className="block rounded-xl bg-primary text-white py-2.5 text-center text-sm font-semibold active:bg-primary-dark">
              👁 {st.tone === "ok" ? P.viewListing : P.previewListing}
            </Link>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Link href={`/${lc}/partner/listing?hotel=${h.id}`} className="rounded-xl border border-line bg-paper py-2.5 text-center font-medium">✏️ {P.editListing}</Link>
              <Link href={`/${lc}/partner/bookings`} className="rounded-xl border border-line bg-paper py-2.5 text-center font-medium">🧾 {P.bookings}</Link>
            </div>
            {st.tone === "ok" && <p className="text-xs text-muted">/{lc}/hotels/{h.slug}</p>}
          </section>
        );
  }
}
