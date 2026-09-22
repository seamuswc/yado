import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { defaultLocale, isLocale, locales } from "@/lib/i18n";

function pickLocale(request: NextRequest): string {
  const cookie = request.cookies.get("locale")?.value;
  if (cookie && isLocale(cookie)) return cookie;
  const header = request.headers.get("accept-language") ?? "";
  for (const part of header.split(",")) {
    const base = part.split(";")[0].trim().toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return defaultLocale;
}

function randomId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const localeSeg = pathname.split("/")[1];
  const hasLocale = locales.some((l) => l === localeSeg);
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  if (!hasLocale && !isAdmin) {
    const locale = pickLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  // Pass the path to layouts (for analytics) and tag anonymous visitors.
  const reqHeaders = new Headers(request.headers);
  reqHeaders.set("x-pathname", pathname);
  let vid = request.cookies.get("yado_vid")?.value;
  const newVisitor = !vid;
  if (!vid) vid = randomId();
  reqHeaders.set("x-visitor-id", vid);
  const res = NextResponse.next({ request: { headers: reqHeaders } });
  const secure = process.env.NODE_ENV === "production";
  if (newVisitor) res.cookies.set("yado_vid", vid, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true, secure });
  if (hasLocale && request.cookies.get("locale")?.value !== localeSeg) {
    res.cookies.set("locale", localeSeg, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure });
  }
  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
