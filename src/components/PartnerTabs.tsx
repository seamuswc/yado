import Link from "next/link";
import type { Dictionary, Locale } from "@/lib/i18n";

export type PartnerTab = "dashboard" | "property" | "bookings" | "api";

/**
 * Partner section navigation. Tabs size to their label and the strip scrolls sideways on narrow phones,
 * so adding a tab never squeezes the others.
 */
export default function PartnerTabs({ locale, dict, current }: { locale: Locale; dict: Dictionary; current: PartnerTab }) {
  const items = [
    { id: "dashboard" as const, href: `/${locale}/partner`, label: dict.partner.dashboard, icon: "🏠" },
    { id: "property" as const, href: `/${locale}/partner/property`, label: dict.partner.propertyTab, icon: "📍" },
    { id: "bookings" as const, href: `/${locale}/partner/bookings`, label: dict.partner.bookings, icon: "🧾" },
    { id: "api" as const, href: `/${locale}/partner/api`, label: dict.partner.apiTab, icon: "🔑" },
  ];
  return (
    <nav aria-label={dict.partner.dashboard} className="-mx-4 px-4 overflow-x-auto hide-scrollbar">
      <ul className="flex gap-1 rounded-xl bg-paper border border-line p-1 w-max min-w-full">
        {items.map((it) => {
          const active = it.id === current;
          return (
            <li key={it.id} className="flex-1">
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-primary text-white" : "text-muted hover:text-ink"}`}
              >
                <span aria-hidden className="text-base leading-none">{it.icon}</span>
                <span>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
