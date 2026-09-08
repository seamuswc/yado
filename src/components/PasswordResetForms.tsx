"use client";

import { useActionState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { requestPasswordReset, resetPassword } from "@/actions/auth";
import SubmitButton from "./SubmitButton";

const field = "w-full rounded-xl border border-line bg-card px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-primary/40";

export function RequestResetForm({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const [state, action] = useActionState(requestPasswordReset, {});
  if (state.ok) return <div className="rounded-2xl bg-card border border-line p-5 text-center"><p className="text-3xl mb-2">📬</p><p className="text-sm">{state.message}</p></div>;
  return (
    <form action={action} className="rounded-2xl bg-card border border-line p-4 space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <h2 className="font-semibold">{dict.auth.resetTitle}</h2>
      <p className="text-sm text-muted">{dict.auth.resetIntro}</p>
      <div>
        <label htmlFor="rr-email" className="block text-xs font-medium text-muted mb-1">{dict.auth.email}</label>
        <input id="rr-email" name="email" type="email" required autoComplete="username" className={field} />
      </div>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <SubmitButton className="w-full">{dict.auth.sendReset}</SubmitButton>
    </form>
  );
}

export function SetPasswordForm({ locale, dict, token }: { locale: Locale; dict: Dictionary; token: string }) {
  const [state, action] = useActionState(resetPassword, {});
  return (
    <form action={action} className="rounded-2xl bg-card border border-line p-4 space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="token" value={token} />
      <h2 className="font-semibold">{dict.auth.resetTitle}</h2>
      <div>
        <label htmlFor="np" className="block text-xs font-medium text-muted mb-1">{dict.auth.newPassword}</label>
        <input id="np" name="password" type="password" required minLength={10} autoComplete="new-password" className={field} />
        <p className="text-xs text-muted mt-1">{dict.partner.passwordHint}</p>
      </div>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <SubmitButton className="w-full">{dict.auth.setPassword}</SubmitButton>
    </form>
  );
}
