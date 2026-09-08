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

  return (
    <header className="sticky top-0 z-20 bg-paper/90 backdrop-blur border-b border-line">
      <div className="max-w-md mx-auto flex items-center justify-between px-4 h-14 gap-2">
        <Link href={`/${locale}`} className="flex items-center gap-2 shrink-0">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white font-bold">宿</span>
          <span className="font-semibold tracking-tight">{dict.appName}</span>
        </Link>
        <div className="flex items-center gap-2 min-w-0">
          {user ? (
            <>
              <Link href={accountHref} className="hidden sm:inline text-xs text-muted truncate max-w-[9rem]" title={user.email}>{user.email}</Link>
              <form action={signOut}>
                <input type="hidden" name="locale" value={locale} />
                <button className="text-xs font-medium px-2.5 py-1.5 rounded-full border border-line bg-card active:bg-primary-soft whitespace-nowrap" aria-label={dict.auth.signOut} title={`${dict.auth.signOut} (${user.email})`}>
                  <span className="sm:hidden" aria-hidden>⏻</span><span className="hidden sm:inline">{dict.auth.signOut}</span>
                </button>
              </form>
            </>
          ) : (
            <Link href={`/${locale}/login`} className="text-xs font-medium px-2.5 py-1.5 rounded-full border border-line bg-card active:bg-primary-soft">{dict.auth.signIn}</Link>
          )}
          <Link
            href={switchHref}
            hrefLang={other}
            className="text-xs font-medium px-2.5 py-1.5 rounded-full border border-line bg-card active:bg-primary-soft whitespace-nowrap"
            aria-label={dict.langSwitch}
          >
            🌐 {dict.langSwitch}
          </Link>
        </div>
      </div>
    </header>
  );
}
