import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, isLocale } from "@/lib/i18n";

/** Shown only when a magic link failed (valid links are handled by /api/auth/magic). */
export default async function MagicPage(props: PageProps<"/[locale]/auth/magic">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  return (
    <div className="px-4 py-16 text-center">
      <p className="text-4xl mb-3">🔗</p>
      <p className="mb-4">{dict.auth.invalidLink}</p>
      <Link href={`/${locale}/login`} className="text-primary underline">{dict.auth.signIn}</Link>
    </div>
  );
}
