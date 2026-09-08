import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import MagicLinkForm from "@/components/MagicLinkForm";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary, isLocale } from "@/lib/i18n";

export default async function LoginPage(props: PageProps<"/[locale]/login">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  if (user) redirect(user.role === "partner" ? `/${locale}/partner` : user.role === "head_admin" ? "/admin" : `/${locale}/bookings`);
  const sp = await props.searchParams;
  const email = typeof sp.email === "string" ? sp.email : "";
  return (
    <div className="px-4 pt-6 space-y-4">
      <h1 className="text-xl font-bold">{dict.auth.signIn}</h1>
      <MagicLinkForm locale={locale} dict={dict} defaultEmail={email} />
      <p className="text-sm text-muted text-center">
        {dict.partner.title}: <Link href={`/${locale}/partner/login`} className="text-primary underline">{dict.auth.partnerTitle}</Link>
        {" · "}
        <Link href={`/${locale}/partner/register`} className="text-primary underline">{dict.partner.listYourProperty}</Link>
      </p>
    </div>
  );
}
