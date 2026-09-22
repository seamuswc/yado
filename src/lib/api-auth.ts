import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import type { User } from "@/db/schema";
import { newId, newToken, nowIso, sha256 } from "./ids";

const MAX_ACTIVE_KEYS = 10;

export type ApiActor = { user: User; keyId: string };

export function issueApiKey(userId: string, label: string): { id: string; token: string; prefix: string } {
  const active = db.select({ id: schema.apiKeys.id }).from(schema.apiKeys)
    .where(and(eq(schema.apiKeys.userId, userId), isNull(schema.apiKeys.revokedAt))).all();
  if (active.length >= MAX_ACTIVE_KEYS) throw new Error("too_many_keys");
  const token = `yado_${newToken()}`;
  const id = newId("key_");
  const prefix = token.slice(0, 13);
  db.insert(schema.apiKeys).values({
    id, tokenHash: sha256(token), token, userId, label: label.trim().slice(0, 40), prefix,
  }).run();
  return { id, token, prefix };
}

/** Dashboard list. Includes the secret so the owner can copy it. Do not send this from the public API. */
export function listOwnedApiKeys(userId: string) {
  return db.select({
    id: schema.apiKeys.id,
    token: schema.apiKeys.token,
    prefix: schema.apiKeys.prefix,
    label: schema.apiKeys.label,
    createdAt: schema.apiKeys.createdAt,
    lastUsedAt: schema.apiKeys.lastUsedAt,
    revokedAt: schema.apiKeys.revokedAt,
  }).from(schema.apiKeys).where(eq(schema.apiKeys.userId, userId)).all();
}

export function listApiKeys(userId: string) {
  return db.select({
    id: schema.apiKeys.id,
    prefix: schema.apiKeys.prefix,
    label: schema.apiKeys.label,
    createdAt: schema.apiKeys.createdAt,
    lastUsedAt: schema.apiKeys.lastUsedAt,
    revokedAt: schema.apiKeys.revokedAt,
  }).from(schema.apiKeys).where(eq(schema.apiKeys.userId, userId)).all();
}

export function renameApiKey(userId: string, keyId: string, label: string): boolean {
  const res = db.update(schema.apiKeys).set({ label: label.trim().slice(0, 40) })
    .where(and(eq(schema.apiKeys.id, keyId), eq(schema.apiKeys.userId, userId), isNull(schema.apiKeys.revokedAt))).run();
  return res.changes > 0;
}

export function revokeApiKey(userId: string, keyId: string): boolean {
  const res = db.update(schema.apiKeys).set({ revokedAt: nowIso() })
    .where(and(eq(schema.apiKeys.id, keyId), eq(schema.apiKeys.userId, userId), isNull(schema.apiKeys.revokedAt))).run();
  return res.changes > 0;
}

/** Resolves a Bearer secret to its user. Updates last-used. Returns null when the key is unknown or revoked. */
export function userFromApiKey(token: string): ApiActor | null {
  if (!token.startsWith("yado_")) return null;
  const row = db.select({ key: schema.apiKeys, user: schema.users })
    .from(schema.apiKeys)
    .innerJoin(schema.users, eq(schema.apiKeys.userId, schema.users.id))
    .where(and(eq(schema.apiKeys.tokenHash, sha256(token)), isNull(schema.apiKeys.revokedAt), isNull(schema.users.disabledAt)))
    .get();
  if (!row?.user.emailVerifiedAt) return null;
  db.update(schema.apiKeys).set({ lastUsedAt: nowIso() }).where(eq(schema.apiKeys.id, row.key.id)).run();
  return { user: row.user, keyId: row.key.id };
}
