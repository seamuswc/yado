import { requireAdminPage } from "@/lib/auth";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { capacityAssessment, localeSplit, recentSamples, topPages, weeklyStats } from "@/lib/analytics";
import { BarChart, LineChart, Stat } from "@/components/admin/Charts";
import { Badge, Card, PageTitle, Table, yen } from "@/components/admin/ui";
import { stripeConfigured } from "@/lib/stripe";
import { translationAvailable } from "@/lib/translate";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  await requireAdminPage();
  const weekly = weeklyStats(8);
  const cap = capacityAssessment(weekly);
  const cur = weekly[weekly.length - 1];
  const prev = weekly[weekly.length - 2];
  const delta = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : a > 0 ? 100 : null);
  const wk = (s: string) => { const d = new Date(s + "T00:00:00Z"); return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`; };

  const pendingHotels = db.select({ n: sql<number>`count(*)` }).from(schema.hotels).where(sql`status='pending'`).get()?.n ?? 0;
  const liveHotels = db.select({ n: sql<number>`count(*)` }).from(schema.hotels).where(sql`status='approved' and paid_until > strftime('%Y-%m-%dT%H:%M:%fZ','now')`).get()?.n ?? 0;
  const feeDue = db.select({ n: sql<number>`count(*)` }).from(schema.hotels).where(sql`status='approved' and (paid_until is null or paid_until <= strftime('%Y-%m-%dT%H:%M:%fZ','now'))`).get()?.n ?? 0;
  const guests = db.select({ n: sql<number>`count(*)` }).from(schema.users).where(sql`role='guest'`).get()?.n ?? 0;

  const sampled = recentSamples(24, 48);
  const tlabel = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });

  const levelTone = cap.level === "ok" ? "ok" : cap.level === "watch" ? "warn" : "bad";
  const levelText = cap.level === "ok" ? "No upgrade needed" : cap.level === "watch" ? "Watch: plan the next step" : "Upgrade recommended";

  return (
    <div className="space-y-6">
      <PageTitle sub="Weekly usage, revenue, and whether the server needs more headroom.">Dashboard</PageTitle>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Stat label="Visits this week" value={cur.visits.toLocaleString()} delta={delta(cur.visits, prev?.visits ?? 0)} hint={`${cur.visitors} unique visitors`} />
        <Stat label="Searches this week" value={cur.searches.toLocaleString()} delta={delta(cur.searches, prev?.searches ?? 0)} />
        <Stat label="Confirmed bookings" value={cur.bookings.toLocaleString()} delta={delta(cur.bookings, prev?.bookings ?? 0)} />
        <Stat label="Booking revenue" value={yen(cur.revenue)} delta={delta(cur.revenue, prev?.revenue ?? 0)} hint="Gross, confirmed this week" />
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Stat label="Live hotels" value={String(liveHotels)} hint={feeDue ? `${feeDue} approved, fee unpaid` : "All approved hotels are paid up"} />
        <Stat label="Awaiting review" value={String(pendingHotels)} hint="Registrations queue" />
        <Stat label="Guest accounts" value={guests.toLocaleString()} />
        <Stat label="Integrations" value={`${stripeConfigured() ? "Stripe ✓" : "Stripe demo"}`} hint={`${translationAvailable() ? "Translation ✓" : "Translation off"} · ${process.env.RESEND_API_KEY ? "Email ✓" : "Email to outbox"}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Visits per week"><BarChart data={weekly.map((w) => ({ label: wk(w.weekStart), value: w.visits, hint: `Week of ${w.weekStart}: ${w.visits} visits, ${w.visitors} visitors` }))} /></Card>
        <Card title="Confirmed bookings per week"><BarChart data={weekly.map((w) => ({ label: wk(w.weekStart), value: w.bookings, hint: `Week of ${w.weekStart}: ${w.bookings} bookings` }))} /></Card>
        <Card title="Revenue per week (JPY)"><BarChart data={weekly.map((w) => ({ label: wk(w.weekStart), value: w.revenue, hint: `Week of ${w.weekStart}: ${yen(w.revenue)}` }))} format={(v) => (v >= 10000 ? `${Math.round(v / 10000)}万` : String(Math.round(v)))} /></Card>
      </div>

      <Card title={<span className="flex items-center gap-2">Server capacity <Badge tone={levelTone}>{levelText}</Badge></span>}>
        <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
          <div>
            <ul className="text-sm space-y-1.5">
              {cap.reasons.map((r) => <li key={r} className="flex gap-2"><span className="text-muted">•</span>{r}</li>)}
            </ul>
            <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted">Peak requests/min (7d)</dt><dd>{cap.peakReqPerMin}</dd>
              <dt className="text-muted">Avg event-loop lag</dt><dd>{cap.avgLagMs.toFixed(1)} ms</dd>
              <dt className="text-muted">Peak memory</dt><dd>{cap.peakRssPct.toFixed(0)}% of {cap.latest ? `${(cap.latest.totalMemMb / 1024).toFixed(0)} GB` : "—"}</dd>
              <dt className="text-muted">Peak CPU load</dt><dd>{cap.peakLoadPct.toFixed(0)}% per core ({cap.latest?.cpus ?? "?"} cores)</dd>
              <dt className="text-muted">Database size</dt><dd>{cap.latest ? `${cap.latest.dbSizeMb.toFixed(1)} MB` : "—"}</dd>
              <dt className="text-muted">Visits growth</dt><dd>{cap.weeklyGrowthPct === null ? "—" : `${cap.weeklyGrowthPct.toFixed(0)}% w/w`}</dd>
              <dt className="text-muted">Samples (7d)</dt><dd>{cap.sampleCount}</dd>
            </dl>
            <p className="text-xs text-muted mt-3">Rule of thumb: upgrade when memory or CPU peaks above 80–90%, event-loop lag stays above 100 ms, or traffic passes ~600 requests/min. Before adding servers, move SQLite to Postgres so several app instances can share one database.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><p className="text-xs font-medium mb-1">Requests per minute (24h)</p><LineChart data={sampled.map((s) => ({ label: tlabel(s.createdAt), value: s.requestsLastMinute }))} /></div>
            <div><p className="text-xs font-medium mb-1">Event-loop lag, ms (24h)</p><LineChart data={sampled.map((s) => ({ label: tlabel(s.createdAt), value: Math.round(s.eventLoopLagMs) }))} threshold={100} /></div>
            <div><p className="text-xs font-medium mb-1">Memory used by app, % of machine (24h)</p><LineChart data={sampled.map((s) => ({ label: tlabel(s.createdAt), value: Math.round((s.rssMb / s.totalMemMb) * 100), hint: `${tlabel(s.createdAt)}: ${Math.round(s.rssMb)} MB (${Math.round((s.rssMb / s.totalMemMb) * 100)}%)` }))} threshold={80} /></div>
            <div><p className="text-xs font-medium mb-1">CPU load per core, % (24h)</p><LineChart data={sampled.map((s) => ({ label: tlabel(s.createdAt), value: Math.round((s.load1 / s.cpus) * 100) }))} threshold={90} /></div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Top pages (7 days)">
          <Table head={["Path", "Views"]}>
            {topPages().map((p) => <tr key={p.path}><td className="px-3 py-1.5 font-mono text-xs">{p.path || "/"}</td><td className="px-3 py-1.5">{p.n}</td></tr>)}
          </Table>
        </Card>
        <Card title="Language split (7 days)">
          <Table head={["Locale", "Views"]}>
            {localeSplit().map((l) => <tr key={l.locale}><td className="px-3 py-1.5">{l.locale || "—"}</td><td className="px-3 py-1.5">{l.n}</td></tr>)}
          </Table>
        </Card>
        <Card title="Weekly table">
          <Table head={["Week", "Visits", "Search", "Bookings", "Revenue", "New hotels"]}>
            {weekly.map((w) => <tr key={w.weekStart}><td className="px-3 py-1.5 text-xs">{w.weekStart}</td><td className="px-3 py-1.5">{w.visits}</td><td className="px-3 py-1.5">{w.searches}</td><td className="px-3 py-1.5">{w.bookings}</td><td className="px-3 py-1.5">{yen(w.revenue)}</td><td className="px-3 py-1.5">{w.registrations}</td></tr>)}
          </Table>
        </Card>
      </div>
    </div>
  );
}
