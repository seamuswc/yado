import "server-only";
import os from "node:os";
import fs from "node:fs";
import { and, gte, lt, sql, desc } from "drizzle-orm";
import { db, schema, DB_PATH } from "@/db";

// ---------- request counter shared with instrumentation ----------
const g = globalThis as unknown as { __yadoReqCount?: number };
export function countRequest() { g.__yadoReqCount = (g.__yadoReqCount ?? 0) + 1; }
export function takeRequestCount(): number { const n = g.__yadoReqCount ?? 0; g.__yadoReqCount = 0; return n; }

/** Record a product event. Never throws: analytics must not break a page. */
export function track(type: string, opts: { path?: string; locale?: string; visitorId?: string; meta?: Record<string, unknown> } = {}) {
  try {
    db.insert(schema.events).values({
      type, path: opts.path ?? "", locale: opts.locale ?? "", visitorId: opts.visitorId ?? "",
      meta: opts.meta ? JSON.stringify(opts.meta) : "",
    }).run();
  } catch (e) {
    console.warn("track failed", e);
  }
}

export function takeServerSample() {
  const mem = process.memoryUsage();
  const lag = globalThis.__yadoLoopLag ?? 0;
  let dbSizeMb = 0;
  try { dbSizeMb = fs.statSync(DB_PATH).size / 1_048_576; } catch { /* no db yet */ }
  db.insert(schema.serverSamples).values({
    rssMb: mem.rss / 1_048_576,
    heapUsedMb: mem.heapUsed / 1_048_576,
    totalMemMb: os.totalmem() / 1_048_576,
    load1: os.loadavg()[0],
    cpus: os.cpus().length || 1,
    eventLoopLagMs: lag,
    dbSizeMb,
    requestsLastMinute: takeRequestCount(),
  }).run();
}
declare global { var __yadoLoopLag: number | undefined; }

// ---------- dashboard queries ----------

export type WeekRow = { weekStart: string; visits: number; visitors: number; searches: number; bookings: number; revenue: number; registrations: number };

function isoWeekStart(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (x.getUTCDay() + 6) % 7; // Monday = 0
  x.setUTCDate(x.getUTCDate() - day);
  return x;
}

export function weeklyStats(weeks = 8): WeekRow[] {
  const rows: WeekRow[] = [];
  const thisWeek = isoWeekStart(new Date());
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(thisWeek); start.setUTCDate(start.getUTCDate() - i * 7);
    const end = new Date(start); end.setUTCDate(end.getUTCDate() + 7);
    const s = start.toISOString(), e = end.toISOString();
    const ev = db.select({
      visits: sql<number>`sum(case when type='page_view' then 1 else 0 end)`,
      visitors: sql<number>`count(distinct case when type='page_view' and visitor_id<>'' then visitor_id end)`,
      searches: sql<number>`sum(case when type='search' then 1 else 0 end)`,
    }).from(schema.events).where(and(gte(schema.events.createdAt, s), lt(schema.events.createdAt, e))).get();
    const bk = db.select({
      bookings: sql<number>`count(*)`,
      revenue: sql<number>`coalesce(sum(total),0)`,
    }).from(schema.bookings).where(and(gte(schema.bookings.createdAt, s), lt(schema.bookings.createdAt, e), sql`status in ('confirmed')`)).get();
    const reg = db.select({ n: sql<number>`count(*)` }).from(schema.hotels).where(and(gte(schema.hotels.createdAt, s), lt(schema.hotels.createdAt, e))).get();
    rows.push({
      weekStart: s.slice(0, 10),
      visits: ev?.visits ?? 0, visitors: ev?.visitors ?? 0, searches: ev?.searches ?? 0,
      bookings: bk?.bookings ?? 0, revenue: bk?.revenue ?? 0, registrations: reg?.n ?? 0,
    });
  }
  return rows;
}

export type Capacity = {
  level: "ok" | "watch" | "upgrade";
  reasons: string[];
  latest: typeof schema.serverSamples.$inferSelect | null;
  peakReqPerMin: number;
  avgLagMs: number;
  peakRssPct: number;
  peakLoadPct: number;
  weeklyGrowthPct: number | null;
  sampleCount: number;
};

/** Heuristic capacity assessment from the last 7 days of samples plus traffic growth. */
export function capacityAssessment(weekly: WeekRow[]): Capacity {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const samples = db.select().from(schema.serverSamples).where(gte(schema.serverSamples.createdAt, since)).orderBy(desc(schema.serverSamples.createdAt)).all();
  const latest = samples[0] ?? null;
  const peakReqPerMin = Math.max(0, ...samples.map((s) => s.requestsLastMinute));
  const avgLagMs = samples.length ? samples.reduce((a, s) => a + s.eventLoopLagMs, 0) / samples.length : 0;
  const peakRssPct = Math.max(0, ...samples.map((s) => (s.rssMb / s.totalMemMb) * 100));
  const peakLoadPct = Math.max(0, ...samples.map((s) => (s.load1 / s.cpus) * 100));
  const last = weekly[weekly.length - 1]?.visits ?? 0;
  const prev = weekly[weekly.length - 2]?.visits ?? 0;
  const weeklyGrowthPct = prev > 0 ? ((last - prev) / prev) * 100 : null;

  const reasons: string[] = [];
  let level: Capacity["level"] = "ok";
  const bump = (l: Capacity["level"], r: string) => { reasons.push(r); if (l === "upgrade" || level === "ok") level = l; };
  if (peakRssPct > 80) bump("upgrade", `Memory peaked at ${peakRssPct.toFixed(0)}% of the machine`);
  else if (peakRssPct > 60) bump("watch", `Memory peaked at ${peakRssPct.toFixed(0)}% of the machine`);
  if (peakLoadPct > 90) bump("upgrade", `CPU load peaked at ${peakLoadPct.toFixed(0)}% per core`);
  else if (peakLoadPct > 70) bump("watch", `CPU load peaked at ${peakLoadPct.toFixed(0)}% per core`);
  if (avgLagMs > 100) bump("upgrade", `Event-loop lag averaged ${avgLagMs.toFixed(0)} ms (requests are queueing)`);
  else if (avgLagMs > 30) bump("watch", `Event-loop lag averaged ${avgLagMs.toFixed(0)} ms`);
  if (peakReqPerMin > 600) bump("upgrade", `Peak traffic ${peakReqPerMin} requests/min: a single SQLite node will struggle; move to Postgres + 2 app instances`);
  else if (peakReqPerMin > 200) bump("watch", `Peak traffic ${peakReqPerMin} requests/min: plan the move to Postgres`);
  if (weeklyGrowthPct !== null && weeklyGrowthPct > 50) bump("watch", `Visits grew ${weeklyGrowthPct.toFixed(0)}% week over week`);
  if ((latest?.dbSizeMb ?? 0) > 500) bump("watch", `Database is ${latest!.dbSizeMb.toFixed(0)} MB; schedule a move to Postgres`);
  if (samples.length < 10) reasons.push("Fewer than 10 minutes of samples so far; assessment will firm up as data accumulates");
  if (reasons.length === 0) reasons.push("All signals within normal range");
  return { level, reasons, latest, peakReqPerMin, avgLagMs, peakRssPct, peakLoadPct, weeklyGrowthPct, sampleCount: samples.length };
}

export function topPages(days = 7, limit = 8) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  return db.select({ path: schema.events.path, n: sql<number>`count(*)` })
    .from(schema.events)
    .where(and(gte(schema.events.createdAt, since), sql`type='page_view'`))
    .groupBy(schema.events.path).orderBy(desc(sql`count(*)`)).limit(limit).all();
}

export function localeSplit(days = 7) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  return db.select({ locale: schema.events.locale, n: sql<number>`count(*)` })
    .from(schema.events)
    .where(and(gte(schema.events.createdAt, since), sql`type='page_view'`))
    .groupBy(schema.events.locale).all();
}

/** Server samples from the last N hours, oldest first, thinned to at most `points`. */
export function recentSamples(hours = 24, points = 48) {
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();
  const rows = db.select().from(schema.serverSamples).where(gte(schema.serverSamples.createdAt, since)).orderBy(desc(schema.serverSamples.createdAt)).limit(hours * 60).all().reverse();
  const stride = Math.max(1, Math.floor(rows.length / points));
  return rows.filter((_, i) => i % stride === 0);
}

/** Keep 30 days of minute samples; keep events for a year. */
export function pruneSamples() {
  db.delete(schema.serverSamples).where(lt(schema.serverSamples.createdAt, new Date(Date.now() - 30 * 86_400_000).toISOString())).run();
  db.delete(schema.events).where(lt(schema.events.createdAt, new Date(Date.now() - 365 * 86_400_000).toISOString())).run();
}
