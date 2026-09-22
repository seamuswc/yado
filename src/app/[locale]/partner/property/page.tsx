import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { desc, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requestChange } from "@/actions/partner";
import ChangeRequestForm from "@/components/ChangeRequestForm";
import PartnerTabs from "@/components/PartnerTabs";
import { getCurrentUser } from "@/lib/auth";
import { publicContactEmail } from "@/lib/email";
import { getCity, mapsUrl, t } from "@/lib/hotels";
import { typeLabel } from "@/lib/hotels-shared";
import { formatDateLong, getDictionary, isLocale } from "@/lib/i18n";
import { partnerHotels } from "@/lib/partner-server";

/** What the owner entered at registration. Read-only here: changes go through Yado. */
export default async function PartnerPropertyPage(props: PageProps<"/[locale]/partner/property">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  if (!user || user.role !== "partner") redirect(`/${locale}/partner/login`);
  const P = dict.partner;
  const hotels = partnerHotels(user.id);
  const contact = publicContactEmail();
  const requests = hotels.length
    ? db.select().from(schema.changeRequests).where(inArray(schema.changeRequests.hotelId, hotels.map((h) => h.id))).orderBy(desc(schema.changeRequests.createdAt)).limit(20).all()
    : [];
  const fieldLabel = (f: schema.ChangeRequest["field"]) =>
    f === "name" ? P.hotelName : f === "type" ? P.type : f === "city" ? P.city : f === "address" ? P.address : f === "pin" ? P.mapPin : P.changeOther;
  const row = "grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm";

  return (
    <div className="px-4 pt-5 space-y-4 md:max-w-2xl md:mx-auto">
      <PartnerTabs locale={locale} dict={dict} current="property" />
      <p className="text-sm text-muted">
        {P.propertyLocked.split("{email}")[0]}
        <a href={`mailto:${contact}`} className="text-primary underline">{contact}</a>
        {P.propertyLocked.split("{email}")[1]}
      </p>

      {hotels.length === 0 && (
        <div className="rounded-2xl bg-card border border-line p-6 text-center">
          <Link href={`/${locale}/partner/register`} className="text-primary underline">{P.listYourProperty}</Link>
        </div>
      )}

      {hotels.map((h) => {
        const city = getCity(h.city);
        const pin = h.latitude != null && h.longitude != null;
        const type = typeLabel[h.type as keyof typeof typeLabel];
        return (
          <section key={h.id} className="rounded-2xl bg-card border border-line p-4 space-y-3">
            <h2 className="font-semibold">{P.propertyTitle}</h2>
            <dl className={row}>
              <dt className="text-muted">{P.hotelName}</dt><dd className="font-medium">{locale === "ja" ? h.nameJa : h.nameEn || h.nameJa}</dd>
              <dt className="text-muted">{P.type}</dt><dd>{type ? type[locale] : h.type}</dd>
              <dt className="text-muted">{P.city}</dt><dd>{city ? t(city.name, locale) : h.city}</dd>
              <dt className="text-muted">{P.address}</dt><dd>{h.address}</dd>
              <dt className="text-muted">{P.mapPin}</dt>
              <dd>
                {pin ? (
                  <a href={mapsUrl({ latitude: h.latitude, longitude: h.longitude, name: { en: h.nameEn, ja: h.nameJa }, address: h.address }, locale)} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    {h.latitude?.toFixed(5)}, {h.longitude?.toFixed(5)} ↗
                  </a>
                ) : <span className="text-muted">{P.noPin}</span>}
              </dd>
              <dt className="text-muted">{P.contactPerson}</dt><dd>{user.name || "—"}<br /><span className="text-muted">{user.email}</span></dd>
              <dt className="text-muted">{P.registeredOn}</dt><dd>{formatDateLong(h.createdAt, locale)}</dd>
            </dl>
            {requests.filter((r) => r.hotelId === h.id).length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted mb-1">{P.openRequests}</p>
                <ul className="divide-y divide-line rounded-xl border border-line bg-paper text-sm">
                  {requests.filter((r) => r.hotelId === h.id).map((r) => (
                    <li key={r.id} className="px-3 py-2 flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="text-muted">{fieldLabel(r.field)}: </span>{r.requested}
                        {r.adminNote && <><br /><span className="text-xs text-muted">{r.adminNote}</span></>}
                      </span>
                      <span className={`shrink-0 text-xs rounded-full border px-2 py-0.5 ${r.status === "open" ? "bg-amber-50 text-amber-800 border-amber-200" : r.status === "done" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-paper text-muted border-line"}`}>
                        {r.status === "open" ? P.changeStatusOpen : r.status === "done" ? P.changeStatusDone : P.changeStatusDeclined}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <ChangeRequestForm locale={locale} dict={dict} hotelId={h.id} action={requestChange} />
          </section>
        );
      })}
    </div>
  );
}
