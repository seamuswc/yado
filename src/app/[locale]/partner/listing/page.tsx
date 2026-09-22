import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import ListingForm from "@/components/ListingForm";
import { toDraft } from "@/lib/listing-draft";
import { updateListing } from "@/actions/partner";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary, isLocale } from "@/lib/i18n";
import { translationAvailable } from "@/lib/translate";

export default async function ListingPage(props: PageProps<"/[locale]/partner/listing">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  if (!user || user.role !== "partner") redirect(`/${locale}/partner/login`);
  const sp = await props.searchParams;
  const hotelId = typeof sp.hotel === "string" ? sp.hotel : "";
  const hotel = db.select().from(schema.hotels).where(and(eq(schema.hotels.id, hotelId), eq(schema.hotels.ownerId, user.id))).get();
  if (!hotel) redirect(`/${locale}/partner`);
  const rooms = db.select().from(schema.rooms).where(eq(schema.rooms.hotelId, hotel.id)).all();
  const active = rooms.filter((r) => r.active);
  const P = dict.partner;
  return (
    <div className="px-4 pt-5 space-y-4">
      <h1 className="text-xl font-bold">{P.editListing}</h1>
      {active.length === 0 && <p className="text-sm text-muted">{P.fillPending}</p>}
      <ListingForm locale={locale} dict={dict} initial={toDraft(hotel, rooms)} mode="edit" action={updateListing} translationAvailable={translationAvailable()} />
    </div>
  );
}
