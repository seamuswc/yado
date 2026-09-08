"use client";

import { useActionState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { requestMagicLink } from "@/actions/auth";
import SubmitButton from "./SubmitButton";

export default function MagicLinkForm({ locale, dict, defaultEmail = "" }: { locale: Locale; dict: Dictionary; defaultEmail?: string }) {
  const [state, action] = useActionState(requestMagicLink, {});
  if (state.ok) {
    return (
      <div className="rounded-2xl bg-card border border-line p-5 text-center">
        <p className="text-3xl mb-2">📬</p>
        <p className="font-semibold">{dict.auth.linkSent}</p>
        <p className="text-sm text-muted mt-1">{state.message}</p>
      </div>
    );
  }
  return (
    <form action={action} className="rounded-2xl bg-card border border-line p-4 space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <div>
        <h2 className="font-semibold">{dict.auth.guestTitle}</h2>
        <p className="text-sm text-muted mt-1">{dict.auth.guestIntro}</p>
      </div>
      <div>
        <label htmlFor="ml-email" className="block text-xs font-medium text-muted mb-1">{dict.auth.email}</label>
        <input id="ml-email" name="email" type="email" required autoComplete="email" inputMode="email" defaultValue={defaultEmail}
          className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-primary/40" />
      </div>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <SubmitButton className="w-full">{dict.auth.sendLink}</SubmitButton>
    </form>
  );
}
