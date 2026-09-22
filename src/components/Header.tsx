"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { Dictionary, Locale } from "@/lib/i18n";
import { signOut } from "@/actions/auth";

export type HeaderUser = { email: string; role: "head_admin" | "partner" | "guest" } | null;

export default function Header({ locale, dict, user }: { locale: Locale; dict: Dictionary; user: HeaderUser }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const other: Locale = locale === "en" ? "ja" : "en";
  const rest = pathname.replace(/^\/(en|ja)(?=\/|$)/, "");
  const qs = search.toString();
  const switchHref = `/${other}${rest}${qs ? `?${qs}` : ""}`;
  const accountHref = user?.role === "partner" ? `/${locale}/partner` : user?.role === "head_admin" ? "/admin" : `/${locale}/bookings`;
  const bookingsHref = user?.role === "partner" ? `/${locale}/partner/bookings` : `/${locale}/bookings`;
  // Desktop-only links; phones get the same three in the bottom bar.
  const nav = [
    { href: `/${locale}`, label: dict.nav.home, exact: true },
    { href: `/${locale}/search`, label: dict.nav.search, exact: false },
    { href: bookingsHref, label: dict.nav.bookings, exact: false },
  ];
  const pill = "inline-flex items-center text-xs font-medium px-3 py-2.5 rounded-full border border-line bg-card hover:bg-primary-soft active:bg-primary-soft whitespace-nowrap min-h-10";

  return (
    <header className="sticky top-0 z-20 bg-paper/90 backdrop-blur border-b border-line">
      <div className="max-w-md md:max-w-5xl mx-auto flex items-center justify-between px-4 h-14 gap-2">
        <div className="flex items-center gap-6 min-w-0">
          <Link href={`/${locale}`} className="flex items-center gap-2 shrink-0">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white font-bold" translate="no">宿</span>
            <span className="font-semibold tracking-tight">{dict.appName}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1" aria-label={dict.nav.home}>
            {nav.map((it) => {
              const active = it.exact ? pathname === it.href : pathname.startsWith(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  aria-current={active ? "page" : undefined}
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${active ? "text-primary bg-primary-soft" : "text-muted hover:text-ink hover:bg-card"}`}
                >
                  {it.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          {user ? (
            <>
              <Link href={accountHref} className="hidden sm:inline text-xs text-muted truncate max-w-[9rem] md:max-w-[14rem] hover:text-ink" title={user.email}>{user.email}</Link>
              <form action={signOut}>
                <input type="hidden" name="locale" value={locale} />
                <button className={pill} aria-label={dict.auth.signOut} title={`${dict.auth.signOut} (${user.email})`}>
                  <span className="sm:hidden" aria-hidden>⏻</span><span className="hidden sm:inline">{dict.auth.signOut}</span>
                </button>
              </form>
            </>
          ) : (
            <Link href={`/${locale}/login`} className={pill}>{dict.auth.signIn}</Link>
          )}
          <Link href={switchHref} hrefLang={other} className={pill} aria-label={dict.langSwitch}>
            🌐 {dict.langSwitch}
          </Link>
        </div>
      </div>
    </header>
  );
}
