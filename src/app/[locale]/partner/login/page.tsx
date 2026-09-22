import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import PasswordLoginForm from "@/components/PasswordLoginForm";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary, isLocale } from "@/lib/i18n";

export default async function PartnerLoginPage(props: PageProps<"/[locale]/partner/login">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  if (user?.role === "partner") redirect(`/${locale}/partner`);
  return (
    <div className="px-4 pt-6 space-y-4 md:max-w-md md:mx-auto md:pt-12">
      <h1 className="text-xl font-bold">{dict.partner.portal}</h1>
      <PasswordLoginForm locale={locale} dict={dict} title={dict.auth.partnerTitle} next={`/${locale}/partner`} forgotHref={`/${locale}/partner/reset`} />
      <p className="text-sm text-center text-muted"><Link href={`/${locale}/partner/register`} className="text-primary underline">{dict.partner.listYourProperty}</Link></p>
    </div>
  );
}
