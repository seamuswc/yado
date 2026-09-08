"use client";

import { useActionState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import Link from "next/link";
import { signInWithPassword } from "@/actions/auth";
import SubmitButton from "./SubmitButton";

export default function PasswordLoginForm({ locale, dict, next, title, forgotHref }: { locale: Locale; dict: Dictionary; next?: string; title: string; forgotHref?: string }) {
  const [state, action] = useActionState(signInWithPassword, {});
  const field = "w-full rounded-xl border border-line bg-card px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-primary/40";
  return (
    <form action={action} className="rounded-2xl bg-card border border-line p-4 space-y-3">
      <input type="hidden" name="locale" value={locale} />
      {next && <input type="hidden" name="next" value={next} />}
      <h2 className="font-semibold">{title}</h2>
      <div>
        <label htmlFor="pl-email" className="block text-xs font-medium text-muted mb-1">{dict.auth.email}</label>
        <input id="pl-email" name="email" type="email" required autoComplete="username" className={field} />
      </div>
      <div>
        <label htmlFor="pl-pass" className="block text-xs font-medium text-muted mb-1">{dict.auth.password}</label>
        <input id="pl-pass" name="password" type="password" required autoComplete="current-password" className={field} />
      </div>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <SubmitButton className="w-full">{dict.auth.signInButton}</SubmitButton>
      {forgotHref && <p className="text-center text-xs"><Link href={forgotHref} className="text-primary underline">{dict.auth.forgot}</Link></p>}
    </form>
  );
}
