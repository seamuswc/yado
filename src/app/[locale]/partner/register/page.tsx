import Link from "next/link";
import { notFound } from "next/navigation";
import RegisterForm from "@/components/RegisterForm";
import { addProperty, registerPartner } from "@/actions/partner";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary, isLocale } from "@/lib/i18n";

export default async function RegisterPage(props: PageProps<"/[locale]/partner/register">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const P = dict.partner;
  const user = await getCurrentUser();
  const signedIn = user?.role === "partner";
  return (
    <div className="px-4 pt-5 md:max-w-2xl md:mx-auto">
      <h1 className="text-xl font-bold">{signedIn ? P.addPropertyTitle : P.registerTitle}</h1>
      <p className="text-sm text-muted mt-1">{P.registerIntro}</p>
      {!signedIn && (
        <ol className="mt-3 mb-5 space-y-1 text-sm">
          {P.steps.map((s, i) => (
            <li key={s} className="flex gap-2"><span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">{i + 1}</span>{s}</li>
          ))}
        </ol>
      )}
      {signedIn && <div className="mb-5" />}
      <RegisterForm locale={locale} dict={dict} action={signedIn ? addProperty : registerPartner} signedIn={signedIn} />
      {!signedIn && (
        <p className="text-sm text-center text-muted mt-6"><Link href={`/${locale}/partner/login`} className="text-primary underline">{P.signInHere}</Link></p>
      )}
    </div>
  );
}
