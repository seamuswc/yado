import { NextResponse, type NextRequest } from "next/server";
import { signInWithToken } from "@/actions/auth";
import { isLocale } from "@/lib/i18n";

/** Guest magic-link target. Consumes the token, starts a session, redirects to bookings. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const l = req.nextUrl.searchParams.get("locale") ?? "en";
  const locale = isLocale(l) ? l : "en";
  const ok = token ? await signInWithToken(token) : false;
  return NextResponse.redirect(new URL(ok ? `/${locale}/bookings` : `/${locale}/auth/magic?ok=0`, req.url));
}
