"use server";

import { getCurrentUser, rateLimit } from "@/lib/auth";
import { issueApiKey, revokeApiKey } from "@/lib/api-auth";

export async function mintApiKey(label: string): Promise<{ token?: string; key?: { id: string; prefix: string; label: string }; error?: string }> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "partner" && user.role !== "guest") || !user.emailVerifiedAt) {
    return { error: "Sign in with a verified guest or partner account." };
  }
  if (!rateLimit(`apikey:${user.id}`, 10, 60 * 60_000)) return { error: "Too many keys created. Try again in an hour." };
  try {
    const key = issueApiKey(user.id, label || (user.role === "partner" ? "Partner assistant" : "Guest assistant"));
    return { token: key.token, key: { id: key.id, prefix: key.prefix, label: label.trim().slice(0, 40) || (user.role === "partner" ? "Partner assistant" : "Guest assistant") } };
  } catch {
    return { error: "You already have 10 active keys. Revoke one first." };
  }
}

export async function revokeApiKeyAction(keyId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  revokeApiKey(user.id, keyId);
}
