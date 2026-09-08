import Link from "next/link";

export function PageTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-bold tracking-tight">{children}</h1>
      {sub && <p className="text-sm text-muted mt-1">{sub}</p>}
    </div>
  );
}

export function Card({ children, className = "", title }: { children: React.ReactNode; className?: string; title?: React.ReactNode }) {
  return (
    <section className={`rounded-2xl bg-card border border-line p-4 ${className}`}>
      {title && <h2 className="font-semibold mb-3">{title}</h2>}
      {children}
    </section>
  );
}

export function Badge({ tone, children }: { tone: "ok" | "warn" | "bad" | "muted" | "info"; children: React.ReactNode }) {
  const c = {
    ok: "bg-emerald-50 text-emerald-800 border-emerald-200",
    warn: "bg-amber-50 text-amber-800 border-amber-200",
    bad: "bg-red-50 text-red-800 border-red-200",
    info: "bg-sky-50 text-sky-800 border-sky-200",
    muted: "bg-paper text-muted border-line",
  }[tone];
  return <span className={`inline-block text-xs rounded-full border px-2 py-0.5 whitespace-nowrap ${c}`}>{children}</span>;
}

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-card">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted bg-paper">
          <tr>{head.map((h, i) => <th key={i} className="px-3 py-2 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted text-sm">{children}</p>;
}

export function Btn({ children, tone = "default", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "default" | "primary" | "danger" }) {
  const c = tone === "primary" ? "bg-primary text-white border-primary" : tone === "danger" ? "bg-red-50 text-red-800 border-red-200" : "bg-card border-line";
  return <button {...rest} className={`text-xs font-medium rounded-lg border px-2.5 py-1.5 whitespace-nowrap ${c} disabled:opacity-50`}>{children}</button>;
}

export const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo" }) : "—");
export const fmtDay = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-GB", { dateStyle: "medium", timeZone: "Asia/Tokyo" }) : "—");
export const yen = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(n);

export function HotelLink({ id, name }: { id: string; name: string }) {
  return <Link href={`/admin/hotels/${id}`} className="font-medium hover:underline">{name}</Link>;
}
