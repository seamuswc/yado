import { notFound, redirect } from "next/navigation";
import ApiKeyPanel from "@/components/ApiKeyPanel";
import PartnerTabs from "@/components/PartnerTabs";
import { listApiKeys } from "@/lib/api-auth";
import { getCurrentUser } from "@/lib/auth";
import { APP_URL } from "@/lib/email";
import { getDictionary, isLocale } from "@/lib/i18n";

export default async function PartnerApiPage(props: PageProps<"/[locale]/partner/api">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  if (!user || user.role !== "partner") redirect(`/${locale}/partner/login`);
  return (
    <div className="px-4 pt-5 space-y-4">
      <PartnerTabs locale={locale} dict={dict} current="api" />
      <ApiKeyPanel
        audience="partner"
        specUrl={`${APP_URL}/api/v1/openapi.json`}
        keys={listApiKeys(user.id).filter((k) => !k.revokedAt).map((k) => ({ id: k.id, prefix: k.prefix, label: k.label }))}
        copy={dict.api}
      />
    </div>
  );
}
