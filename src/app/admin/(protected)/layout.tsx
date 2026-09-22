import Link from "next/link";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "@/actions/auth";

const nav = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/registrations", label: "Registrations" },
  { href: "/admin/hotels", label: "Hotels" },
  { href: "/admin/changes", label: "Changes" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/emails", label: "Emails" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "head_admin") redirect("/admin/login");
  const pending = db.select({ n: sql<number>`count(*)` }).from(schema.hotels).where(sql`status='pending'`).get()?.n ?? 0;
  const openChanges = db.select({ n: sql<number>`count(*)` }).from(schema.changeRequests).where(sql`status='open'`).get()?.n ?? 0;
  const badge = (href: string) => (href === "/admin/registrations" ? pending : href === "/admin/changes" ? openChanges : 0);
  return (
    <div className="flex-1 flex flex-col">
      <header className="sticky top-0 z-20 bg-card border-b border-line">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link href="/admin" className="flex items-center gap-2 shrink-0">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-white font-bold">宿</span>
            <span className="font-semibold">Yado Admin</span>
          </Link>
          <nav className="flex gap-1 overflow-x-auto hide-scrollbar text-sm">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="px-3 py-1.5 rounded-full hover:bg-paper whitespace-nowrap">
                {n.label}{badge(n.href) > 0 && <span className="ml-1 rounded-full bg-primary text-white text-[11px] px-1.5">{badge(n.href)}</span>}
              </Link>
            ))}
          </nav>
          <form action={signOut} className="shrink-0 flex items-center gap-2 text-xs text-muted">
            <input type="hidden" name="admin" value="1" />
            <span className="hidden sm:inline">{user.email}</span>
            <button className="px-2.5 py-1.5 rounded-full border border-line bg-card">Sign out</button>
          </form>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">{children}</main>
      <footer className="text-center text-xs text-muted py-4">Public site: <Link className="underline" href="/en">/en</Link> · <Link className="underline" href="/ja">/ja</Link></footer>
    </div>
  );
}
