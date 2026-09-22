import { findUserByEmail, rateLimit, verifyPassword } from "@/lib/auth";
import { issueApiKey, listApiKeys, revokeApiKey } from "@/lib/api-auth";
import { tokenBodySchema } from "@/lib/api-schemas";
import { apiError, apiJson, limit, readActor, readJson, zodError } from "@/lib/api-http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const limited = await limit("api:token", 10, 15 * 60_000);
  if (limited) return limited;
  const body = await readJson(req);
  if ("response" in body) return body.response;
  const parsed = tokenBodySchema.safeParse(body.data);
  if (!parsed.success) return zodError(parsed.error);
  if (!rateLimit(`api:token:${parsed.data.email}`, 10, 15 * 60_000)) {
    return apiError(429, "rate_limited", "Too many sign-in attempts for this email. Wait and try again.");
  }
  const user = findUserByEmail(parsed.data.email);
  if (user && !user.disabledAt && !user.passwordHash) {
    return apiError(403, "no_password", "This account has no password. Guests can book without an API key, or create a key while signed in on the website.");
  }
  if (!user || user.disabledAt || !verifyPassword(parsed.data.password, user.passwordHash)) {
    return apiError(401, "invalid_credentials", "Email or password is wrong.");
  }
  if (user.role !== "partner" && user.role !== "guest") {
    return apiError(403, "forbidden", "Admin accounts do not get an assistant API key.");
  }
  if (!user.emailVerifiedAt) {
    return apiError(403, "email_unverified", "Confirm the email address first, then create an API key.");
  }
  try {
    const key = issueApiKey(user.id, parsed.data.label);
    return apiJson({
      token: key.token,
      tokenType: "Bearer",
      keyId: key.id,
      role: user.role,
      email: user.email,
      message: "Send this token as Authorization: Bearer on later requests. You can copy it again from the API key page.",
    }, 201);
  } catch {
    return apiError(409, "too_many_keys", "This account already has 10 active keys. Revoke one with DELETE /api/v1/auth/token using that key.");
  }
}

export async function GET(req: Request) {
  const { actor, response } = await readActor(req);
  if (response) return response;
  if (!actor) return apiError(401, "unauthorized", "Send Authorization: Bearer with your API key.");
  return apiJson({ keys: listApiKeys(actor.user.id) });
}

export async function DELETE(req: Request) {
  const { actor, response } = await readActor(req);
  if (response) return response;
  if (!actor) return apiError(401, "unauthorized", "Send Authorization: Bearer with the key you want to revoke.");
  revokeApiKey(actor.user.id, actor.keyId);
  return apiJson({ revoked: true });
}
