import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import RegisterForm from "@/components/RegisterForm";
import { registerPartner } from "@/actions/partner";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary, isLocale } from "@/lib/i18n";

export default async function RegisterPage(props: PageProps<"/[locale]/partner/register">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  if (user?.role === "partner") redirect(`/${locale}/partner`);
  return (
    <div className="px-4 pt-5">
      <h1 className="text-xl font-bold">{dict.partner.registerTitle}</h1>
      <p className="text-sm text-muted mt-1">{dict.partner.registerIntro}</p>
      <ol className="mt-3 mb-5 space-y-1 text-sm">
        {dict.partner.steps.map((s, i) => (
          <li key={s} className="flex gap-2"><span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">{i + 1}</span>{s}</li>
        ))}
      </ol>
      <RegisterForm locale={locale} dict={dict} action={registerPartner} />
      <p className="text-sm text-center text-muted mt-6"><Link href={`/${locale}/partner/login`} className="text-primary underline">{dict.partner.signInHere}</Link></p>
    </div>
  );
}
