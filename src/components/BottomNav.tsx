"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Dictionary, Locale } from "@/lib/i18n";

export default function BottomNav({ locale, dict, bookingsHref }: { locale: Locale; dict: Dictionary; bookingsHref?: string }) {
  const pathname = usePathname();
  const items = [
    { href: `/${locale}`, label: dict.nav.home, icon: "🏠", exact: true },
    { href: `/${locale}/search`, label: dict.nav.search, icon: "🔍", exact: false },
    { href: bookingsHref ?? `/${locale}/bookings`, label: dict.nav.bookings, icon: "🧾", exact: false },
  ];
  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 bg-card border-t border-line safe-bottom md:hidden">
      <ul className="max-w-md mx-auto grid grid-cols-3">
        {items.map((it) => {
          const active = it.exact ? pathname === it.href : pathname.startsWith(it.href);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={`flex flex-col items-center gap-0.5 py-2 text-xs ${active ? "text-primary font-semibold" : "text-muted"}`}
                aria-current={active ? "page" : undefined}
              >
                <span className="text-xl leading-none" aria-hidden>{it.icon}</span>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
