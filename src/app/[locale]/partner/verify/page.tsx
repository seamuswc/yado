import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, isLocale } from "@/lib/i18n";

export default async function VerifyPage(props: PageProps<"/[locale]/partner/verify">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const sp = await props.searchParams;
  const ok = sp.ok === "1";
  return (
    <div className="px-4 py-16 text-center md:max-w-xl md:mx-auto">
      <p className="text-4xl mb-3">{ok ? "✅" : "⚠️"}</p>
      <h1 className="text-lg font-semibold">{ok ? dict.partner.verifyTitle : dict.partner.verifyFailed}</h1>
      {ok && <p className="text-sm text-muted mt-2">{dict.partner.verifyBody}</p>}
      <Link href={ok ? `/${locale}/partner` : `/${locale}/partner/login`} className="inline-block mt-5 rounded-xl bg-primary text-white font-semibold px-5 py-2.5">
        {ok ? dict.partner.dashboard : dict.auth.signIn}
      </Link>
    </div>
  );
}
