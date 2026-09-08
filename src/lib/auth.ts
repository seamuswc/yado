import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { isoInDays, newId, newToken, nowIso, sha256 } from "./ids";
import type { User } from "@/db/schema";

const SESSION_COOKIE = "yado_session";
const SESSION_DAYS = 30;

export { hashPassword, verifyPassword } from "./password";
import { hashPassword } from "./password";

// ---------- rate limiting (in-memory, per process) ----------

const buckets = new Map<string, { count: number; resetAt: number }>();

/** Returns true when the caller is allowed; false when the limit is exceeded. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= max;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  // Only trust forwarded headers when a reverse proxy in front of us sets them (TRUST_PROXY=1);
  // otherwise a client could spoof its own address and dodge per-IP limits.
  if (process.env.TRUST_PROXY !== "1") return "direct";
  // The rightmost entry is appended by the proxy; earlier entries are client-controlled.
  const xff = h.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  return xff[xff.length - 1] || h.get("x-real-ip") || "direct";
}

// ---------- sessions ----------

export async function createSession(userId: string): Promise<void> {
  const token = newToken();
  const expiresAt = isoInDays(SESSION_DAYS);
  db.insert(schema.sessions).values({ id: sha256(token), userId, expiresAt }).run();
  const store = await cookies();
  store.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(token))).run();
  store.delete(SESSION_COOKIE);
}

/** Current user for this request, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = db
    .select({ user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(and(eq(schema.sessions.id, sha256(token)), gt(schema.sessions.expiresAt, nowIso()), isNull(schema.users.disabledAt)))
    .get();
  return row?.user ?? null;
});

export class AuthError extends Error {}

/** For admin pages: layouts don't re-run on client navigation, so each page re-checks the session itself. */
export async function requireAdminPage(): Promise<User> {
  const u = await getCurrentUser();
  if (!u || u.role !== "head_admin") redirect("/admin/login");
  return u;
}

export async function requireUser(): Promise<User> {
  const u = await getCurrentUser();
  if (!u) throw new AuthError("Sign in required");
  return u;
}

export async function requireRole(...roles: User["role"][]): Promise<User> {
  const u = await requireUser();
  if (!roles.includes(u.role)) throw new AuthError("Not allowed");
  return u;
}

// ---------- one-time tokens (email verification, magic links) ----------

type Purpose = "verify_email" | "reset_password" | "magic_link";

export function issueToken(userId: string, purpose: Purpose, hours = 24): string {
  const token = newToken();
  db.insert(schema.verificationTokens).values({
    id: sha256(token), userId, purpose, expiresAt: new Date(Date.now() + hours * 3_600_000).toISOString(),
  }).run();
  return token;
}

/** Magic link for an email that may not have an account yet; the account is created only when the link is used. */
export function issueEmailToken(email: string, hours = 1): string {
  const token = newToken();
  db.insert(schema.verificationTokens).values({
    id: sha256(token), userId: null, email: email.trim().toLowerCase(), purpose: "magic_link", expiresAt: new Date(Date.now() + hours * 3_600_000).toISOString(),
  }).run();
  return token;
}

/** Atomically consumes a token. Returns its user id / email, or null when invalid, expired or already used. */
export function consumeToken(token: string, purpose: Purpose): { userId: string | null; email: string } | null {
  const id = sha256(token);
  const now = nowIso();
  const row = db.update(schema.verificationTokens).set({ usedAt: now })
    .where(and(eq(schema.verificationTokens.id, id), eq(schema.verificationTokens.purpose, purpose), isNull(schema.verificationTokens.usedAt), gt(schema.verificationTokens.expiresAt, now)))
    .returning({ userId: schema.verificationTokens.userId, email: schema.verificationTokens.email }).get();
  return row ?? null;
}

export function findUserByEmail(email: string): User | undefined {
  return db.select().from(schema.users).where(eq(schema.users.email, email.trim().toLowerCase())).get();
}

export function createUser(input: { email: string; name?: string; role: User["role"]; password?: string; locale?: string; verified?: boolean }): User {
  const user: typeof schema.users.$inferInsert = {
    id: newId("u_"),
    email: input.email.trim().toLowerCase(),
    name: input.name ?? "",
    role: input.role,
    passwordHash: input.password ? hashPassword(input.password) : null,
    locale: input.locale ?? "en",
    emailVerifiedAt: input.verified ? nowIso() : null,
  };
  db.insert(schema.users).values(user).run();
  return db.select().from(schema.users).where(eq(schema.users.id, user.id)).get()!;
}

export function audit(actorId: string | null, action: string, target = "", detail = "") {
  db.insert(schema.auditLog).values({ actorId, action, target, detail }).run();
}
