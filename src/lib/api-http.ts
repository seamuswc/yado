import "server-only";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { clientIp, rateLimit } from "./auth";
import { userFromApiKey, type ApiActor } from "./api-auth";
import { sha256 } from "./ids";

export function apiJson(data: unknown, status = 200, extra?: Record<string, string>) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...extra },
  });
}

export function apiError(status: number, code: string, message: string) {
  return apiJson({ error: { code, message } }, status);
}

export function zodError(err: z.ZodError) {
  const issue = err.issues[0];
  const path = issue?.path.join(".") || "body";
  return apiError(400, "invalid_input", `${path}: ${issue?.message ?? "invalid"}`);
}

export async function readJson(req: Request): Promise<{ data: unknown } | { response: NextResponse }> {
  try {
    return { data: await req.json() };
  } catch {
    return { response: apiError(400, "invalid_json", "Request body must be JSON.") };
  }
}

/** A present but invalid key is an error. No Authorization header means an anonymous caller. */
export async function readActor(req: Request): Promise<{ actor: ApiActor | null; response?: NextResponse }> {
  const header = req.headers.get("authorization");
  if (!header) return { actor: null };
  const match = header.match(/^Bearer\s+(\S+)$/i);
  if (!match) return { actor: null, response: apiError(401, "invalid_token", "Send the API key as Authorization: Bearer yado_…") };
  const actor = userFromApiKey(match[1]);
  if (!actor) return { actor: null, response: apiError(401, "invalid_token", "That API key is invalid, revoked, or the account is not verified.") };
  return { actor };
}

export async function limit(key: string, max: number, windowMs: number): Promise<NextResponse | null> {
  const ip = await clientIp();
  if (!rateLimit(`${key}:${ip}`, max, windowMs)) {
    return apiError(429, "rate_limited", "Too many requests. Wait a few minutes and try again.");
  }
  return null;
}

/** Replays a stored 2xx response when the client retries the same Idempotency-Key. */
export async function idempotent(req: Request, actor: string, run: () => Promise<NextResponse>): Promise<NextResponse> {
  const key = req.headers.get("idempotency-key")?.trim() ?? "";
  if (!key) return run();
  if (key.length < 8 || key.length > 200) return apiError(400, "invalid_input", "Idempotency-Key must be between 8 and 200 characters.");
  const id = sha256(`${actor}\n${new URL(req.url).pathname}\n${req.method}\n${key}`);
  const existing = db.select().from(schema.idempotencyKeys).where(eq(schema.idempotencyKeys.id, id)).get();
  if (existing) {
    return new NextResponse(existing.body, {
      status: existing.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Idempotent-Replayed": "true" },
    });
  }
  const res = await run();
  if (res.status >= 200 && res.status < 300) {
    const body = await res.clone().text();
    try {
      db.insert(schema.idempotencyKeys).values({ id, status: res.status, body }).run();
    } catch {
      const again = db.select().from(schema.idempotencyKeys).where(eq(schema.idempotencyKeys.id, id)).get();
      if (again) {
        return new NextResponse(again.body, {
          status: again.status,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Idempotent-Replayed": "true" },
        });
      }
    }
  }
  return res;
}
