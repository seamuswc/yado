"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit, clientIp, consumeToken, createSession, createUser, destroySession, findUserByEmail, getCurrentUser, hashPassword, issueEmailToken, issueToken, rateLimit, verifyPassword } from "@/lib/auth";
import { APP_URL, sendEmail, templates } from "@/lib/email";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n";
import { nowIso } from "@/lib/ids";

export type ActionState = { error?: string; ok?: boolean; message?: string };

const emailSchema = z.string().trim().toLowerCase().email().max(200);

function loc(v: unknown): Locale { return typeof v === "string" && isLocale(v) ? v : "en"; }

/** Guests: request a magic sign-in link. Always responds the same way so emails can't be enumerated. */
export async function requestMagicLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = loc(formData.get("locale"));
  const d = getDictionary(locale);
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: d.book.invalidEmail };
  const email = parsed.data;
  const ip = await clientIp();
  if (!rateLimit(`magic:${ip}`, 10, 15 * 60_000) || !rateLimit(`magic:${email}`, 5, 15 * 60_000)) return { error: d.auth.rateLimited };

  // Only guest accounts (or addresses with no account yet) may sign in by link; partners/admins use passwords.
  const user = findUserByEmail(email);
  if (!user ? true : user.role === "guest" && !user.disabledAt) {
    const token = user ? issueToken(user.id, "magic_link", 1) : issueEmailToken(email, 1);
    const url = `${APP_URL}/api/auth/magic?token=${token}&locale=${locale}`;
    const t = templates.magicLink(locale, url);
    await sendEmail(email, t.subject, t.body);
  }
  return { ok: true, message: d.auth.linkSentBody };
}

/** Consumes a magic-link token; called from the /auth/magic page. */
export async function signInWithToken(token: string): Promise<boolean> {
  const t = consumeToken(token, "magic_link");
  if (!t) return false;
  let user = t.userId ? db.select().from(schema.users).where(eq(schema.users.id, t.userId)).get() : findUserByEmail(t.email);
  if (!user && t.email) user = createUser({ email: t.email, role: "guest", verified: true });
  if (!user || user.role !== "guest" || user.disabledAt) return false;
  db.update(schema.users).set({ emailVerifiedAt: nowIso() }).where(eq(schema.users.id, user.id)).run();
  await createSession(user.id);
  audit(user.id, "auth.magic_link");
  return true;
}

/** Partners and admins: email + password. */
export async function signInWithPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = loc(formData.get("locale"));
  const d = getDictionary(locale);
  const email = emailSchema.safeParse(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");
  if (!email.success || !password) return { error: d.auth.badCredentials };
  const ip = await clientIp();
  if (!rateLimit(`login:${ip}`, 20, 15 * 60_000) || !rateLimit(`login:${email.data}`, 8, 15 * 60_000)) return { error: d.auth.rateLimited };

  const user = findUserByEmail(email.data);
  if (!user || user.disabledAt || !verifyPassword(password, user.passwordHash)) {
    audit(null, "auth.login_failed", email.data, ip);
    return { error: d.auth.badCredentials };
  }
  if (user.role === "guest") return { error: d.auth.notPartner };
  if (!user.emailVerifiedAt) {
    const token = issueToken(user.id, "verify_email", 24);
    const t = templates.verifyPartner(locale, `${APP_URL}/api/auth/verify?token=${token}&locale=${locale}`);
    await sendEmail(user.email, t.subject, t.body);
    return { error: d.auth.verifyRequired };
  }
  await createSession(user.id);
  audit(user.id, "auth.login");
  const safeNext = next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : null;
  redirect(safeNext ?? (user.role === "head_admin" ? "/admin" : `/${locale}/partner`));
}

export async function signOut(formData: FormData): Promise<void> {
  const locale = loc(formData.get("locale"));
  const user = await getCurrentUser();
  await destroySession();
  if (user) audit(user.id, "auth.logout");
  redirect(formData.get("admin") ? "/admin/login" : `/${locale}`);
}

/** Partners/admins: request a password reset link. Same response whether or not the account exists. */
export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = loc(formData.get("locale"));
  const d = getDictionary(locale);
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: d.book.invalidEmail };
  const ip = await clientIp();
  if (!rateLimit(`reset:${ip}`, 10, 15 * 60_000) || !rateLimit(`reset:${parsed.data}`, 3, 15 * 60_000)) return { error: d.auth.rateLimited };
  const user = findUserByEmail(parsed.data);
  if (user && user.role !== "guest" && !user.disabledAt) {
    const token = issueToken(user.id, "reset_password", 2);
    const t = templates.resetPassword(locale, `${APP_URL}/${locale}/partner/reset?token=${token}`);
    await sendEmail(user.email, t.subject, t.body);
  }
  return { ok: true, message: d.auth.resetSent };
}

const resetSchema = z.object({ token: z.string().min(10), password: z.string().min(10).max(200) });

export async function resetPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = loc(formData.get("locale"));
  const d = getDictionary(locale);
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: `${d.auth.password}: ${d.partner.passwordHint}` };
  const userId = consumeToken(parsed.data.token, "reset_password")?.userId ?? null;
  if (!userId) return { error: d.auth.invalidLink };
  db.update(schema.users).set({ passwordHash: hashPassword(parsed.data.password), emailVerifiedAt: nowIso() }).where(eq(schema.users.id, userId)).run();
  db.delete(schema.sessions).where(eq(schema.sessions.userId, userId)).run(); // sign out everywhere
  await createSession(userId);
  audit(userId, "auth.password_reset");
  const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
  redirect(user?.role === "head_admin" ? "/admin" : `/${locale}/partner`);
}
