import { notFound } from "next/navigation";
import { RequestResetForm, SetPasswordForm } from "@/components/PasswordResetForms";
import { getDictionary, isLocale } from "@/lib/i18n";

export default async function ResetPage(props: PageProps<"/[locale]/partner/reset">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const sp = await props.searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  return (
    <div className="px-4 pt-6 md:max-w-md md:mx-auto md:pt-12">
      <h1 className="text-xl font-bold mb-4">{dict.auth.resetTitle}</h1>
      {token ? <SetPasswordForm locale={locale} dict={dict} token={token} /> : <RequestResetForm locale={locale} dict={dict} />}
    </div>
  );
}
