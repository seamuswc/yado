import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import BookingForm from "@/components/BookingForm";
import { getDictionary, isLocale, nightsBetween } from "@/lib/i18n";
import { getLiveHotel, t } from "@/lib/hotels";
import { readStay, stayQuery } from "@/lib/stay";
import { getCurrentUser } from "@/lib/auth";
import { stripeConfigured } from "@/lib/stripe";

export async function generateMetadata(props: PageProps<"/[locale]/book">): Promise<Metadata> {
  const { locale } = await props.params;
  return isLocale(locale) ? { title: getDictionary(locale).book.title } : {};
}

export default async function BookPage(props: PageProps<"/[locale]/book">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const sp = await props.searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) ?? "";
  const hotel = getLiveHotel(one("hotel"));
  const room = hotel?.rooms.find((r) => r.id === one("room"));
  if (!hotel || !room) redirect(`/${locale}/search`);
  const stay = readStay(sp);
  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  if (nights < 1) redirect(`/${locale}/hotels/${hotel.id}?${stayQuery(stay)}`);
  const user = await getCurrentUser();

  return (
    <div className="px-4 pt-4">
      <h1 className="text-xl font-bold mb-4">{dict.book.title}</h1>
      <BookingForm
        locale={locale} dict={dict}
        hotelSlug={hotel.id} hotelName={t(hotel.name, locale)}
        roomId={room.id} roomName={t(room.name, locale)} refundable={room.refundable}
        stay={stay} nights={nights} pricePerNight={room.pricePerNight}
        stripe={stripeConfigured()} userEmail={user?.role === "guest" ? user.email : null}
      />
    </div>
  );
}
