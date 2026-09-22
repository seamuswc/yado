import Link from "next/link";
import type { Dictionary, Locale } from "@/lib/i18n";

export default function PartnerTabs({ locale, dict, current }: { locale: Locale; dict: Dictionary; current: "dashboard" | "bookings" | "api" }) {
  const items = [
    { id: "dashboard" as const, href: `/${locale}/partner`, label: dict.partner.dashboard },
    { id: "bookings" as const, href: `/${locale}/partner/bookings`, label: dict.partner.bookings },
    { id: "api" as const, href: `/${locale}/partner/api`, label: dict.partner.apiTab },
  ];
  return (
    <nav className="flex gap-1 rounded-xl bg-paper border border-line p-1">
      {items.map((it) => (
        <Link
          key={it.id}
          href={it.href}
          aria-current={it.id === current ? "page" : undefined}
          className={`flex-1 rounded-lg px-2 py-2 text-center text-sm font-medium ${it.id === current ? "bg-primary text-white" : "text-muted"}`}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
