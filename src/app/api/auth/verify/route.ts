import { NextResponse, type NextRequest } from "next/server";
import { verifyPartnerEmail } from "@/actions/partner";
import { isLocale } from "@/lib/i18n";

/** Partner email confirmation link target. Consumes the token, signs the partner in, redirects. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const l = req.nextUrl.searchParams.get("locale") ?? "ja";
  const locale = isLocale(l) ? l : "ja";
  const ok = token ? await verifyPartnerEmail(token) : false;
  return NextResponse.redirect(new URL(`/${locale}/partner/verify?ok=${ok ? 1 : 0}`, req.url));
}
