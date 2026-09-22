import type { Metadata } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { Suspense } from "react";
import "../globals.css";
import { getDictionary, isLocale, locales } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { countRequest, track } from "@/lib/analytics";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const notoJp = Noto_Sans_JP({ subsets: ["latin"], variable: "--font-noto-jp", weight: ["400", "500", "700"] });

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#faf8f5",
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata(props: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await props.params;
  if (!isLocale(locale)) return {};
  const d = getDictionary(locale);
  return { title: { default: `${d.appName} — ${d.tagline}`, template: `%s · ${d.appName}` }, description: d.tagline };
}

export default async function LocaleLayout(props: LayoutProps<"/[locale]">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  const h = await headers();
  const path = h.get("x-pathname") ?? "";
  const visitorId = h.get("x-visitor-id") ?? "";
  const isPrefetch = h.has("next-router-prefetch") || h.get("purpose") === "prefetch";
  countRequest();
  if (!isPrefetch) after(() => {
    // Strip per-hotel ids to keep the top-pages table readable.
    const generic = path.replace(/^\/(en|ja)/, "").replace(/\/hotels\/[^/]+/, "/hotels/:slug") || "/";
    track("page_view", { path: generic, locale, visitorId });
  });

  return (
    <html lang={locale} className={`${inter.variable} ${notoJp.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Suspense fallback={<div className="h-14 border-b border-line" />}>
          <Header locale={locale} dict={dict} user={user ? { email: user.email, role: user.role } : null} />
        </Suspense>
        <main className="flex-1 w-full max-w-md mx-auto pb-24">{props.children}</main>
        <BottomNav locale={locale} dict={dict} bookingsHref={user?.role === "partner" ? `/${locale}/partner/bookings` : undefined} />
      </body>
    </html>
  );
}
