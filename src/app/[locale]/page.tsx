import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import SearchForm from "@/components/SearchForm";
import HotelCard from "@/components/HotelCard";
import PromptExample from "@/components/PromptExample";
import { getDictionary, isLocale } from "@/lib/i18n";
import { cities, listLiveHotels, t } from "@/lib/hotels";
import { readStay, stayQuery } from "@/lib/stay";
import { todayIso } from "@/lib/dates";
import { APP_URL } from "@/lib/email";
import { stripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export default async function Home(props: PageProps<"/[locale]">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const stay = readStay({});
  const hotels = listLiveHotels();
  const featured = [...hotels].sort((a, b) => b.rating * b.reviewCount - a.rating * a.reviewCount).slice(0, 3);
  const q = stayQuery(stay);
  const activeCities = cities.filter((c) => c.id !== "other" && hotels.some((h) => h.city === c.id));
  const guestPrompt = dict.prompt.guestText
    .replace("{api}", `${APP_URL}/api/v1`)
    .replace("{checkIn}", stay.checkIn)
    .replace("{checkOut}", stay.checkOut);

  return (
    <div>
      <section className="px-4 pt-5 pb-6 bg-gradient-to-b from-primary-soft to-paper">
        <h1 className="text-2xl font-bold tracking-tight mb-1">{dict.tagline}</h1>
        <p className="text-sm text-muted mb-4">🇯🇵 {locale === "ja" ? "全国の宿を英語・日本語で検索" : "Hotels, ryokan and hostels across Japan"}</p>
        <div className="rounded-2xl bg-card border border-line p-3 shadow-sm">
          <SearchForm locale={locale} dict={dict} initial={{ q: "", city: "", minPrice: "", maxPrice: "", sort: "recommended", ...stay }} today={todayIso()} />
        </div>
      </section>

      <section className="pt-2 pb-4">
        <div className="flex items-baseline justify-between px-4 mb-2">
          <h2 className="font-semibold">{dict.home.popular}</h2>
          <Link href={`/${locale}/search?${q}`} className="text-sm text-primary">{dict.home.seeAll}</Link>
        </div>
        <div className="flex gap-3 overflow-x-auto px-4 pb-1 hide-scrollbar snap-x">
          {activeCities.map((c) => (
            <Link key={c.id} href={`/${locale}/search?city=${c.id}&${q}`} className="relative shrink-0 w-32 h-24 rounded-xl overflow-hidden snap-start">
              <Image src={c.image} alt={t(c.name, locale)} fill sizes="128px" className="object-cover" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <span className="absolute bottom-2 left-2 text-white font-semibold drop-shadow">{t(c.name, locale)}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="px-4 pb-6">
        <h2 className="font-semibold mb-2">{dict.home.featured}</h2>
        <div className="space-y-3">
          {featured.map((h) => (
            <HotelCard key={h.id} hotel={h} locale={locale} dict={dict} query={q} />
          ))}
        </div>
      </section>

      <section className="px-4 pb-6">
        <PromptExample
          title={dict.prompt.guestTitle}
          intro={dict.prompt.guestIntro}
          text={guestPrompt}
          copy={dict.prompt.copy}
          copied={dict.prompt.copied}
        />
      </section>

      <section className="px-4 pb-6">
        <h2 className="font-semibold mb-2">{dict.home.whyTitle}</h2>
        <ul className="space-y-2">
          {dict.home.why.map((w) => (
            <li key={w.title} className="rounded-xl bg-card border border-line p-3">
              <p className="font-medium">{w.title}</p>
              <p className="text-sm text-muted">{w.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {!stripeConfigured() && <p className="px-4 pb-4 text-xs text-muted text-center">{dict.footer}</p>}
    </div>
  );
}
