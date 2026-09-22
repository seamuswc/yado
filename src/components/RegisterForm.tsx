"use client";

import { useActionState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { cities, typeLabel } from "@/lib/hotels-shared";
import type { ActionState } from "@/actions/auth";
import SubmitButton from "./SubmitButton";

type Props = {
  locale: Locale;
  dict: Dictionary;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  /** Signed-in partner adding a property: no account fields. */
  signedIn?: boolean;
};

export default function RegisterForm({ locale, dict, action, signedIn = false }: Props) {
  const [state, formAction] = useActionState(action, {});
  const P = dict.partner;
  const field = "w-full rounded-xl border border-line bg-card px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-primary/40";
  const label = "block text-xs font-medium text-muted mb-1";

  if (state.ok) {
    return (
      <div className="rounded-2xl bg-card border border-line p-6 text-center">
        <p className="text-4xl mb-2">📨</p>
        <h2 className="font-semibold text-lg">{P.registeredTitle}</h2>
        <p className="text-sm text-muted mt-2">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="locale" value={locale} />
      <div className="hidden" aria-hidden><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>

      {!signedIn && (
        <section className="space-y-3">
          <h2 className="font-semibold">{P.contactName}</h2>
          <div><label className={label} htmlFor="contactName">{P.contactName}</label><input id="contactName" name="contactName" required className={field} autoComplete="name" /></div>
          <div><label className={label} htmlFor="email">{P.email}</label><input id="email" name="email" type="email" required className={field} autoComplete="email" /></div>
          <div><label className={label} htmlFor="password">{P.password}</label><input id="password" name="password" type="password" required minLength={10} className={field} autoComplete="new-password" /><p className="text-xs text-muted mt-1">{P.passwordHint}</p></div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">{P.hotelName}</h2>
        <div><label className={label} htmlFor="nameJa">{P.hotelName}</label><input id="nameJa" name="nameJa" required className={field} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={label} htmlFor="type">{P.type}</label>
            <select id="type" name="type" defaultValue="hotel" className={field}>
              {(Object.keys(typeLabel) as (keyof typeof typeLabel)[]).map((k) => <option key={k} value={k}>{typeLabel[k][locale]}</option>)}
            </select></div>
          <div><label className={label} htmlFor="city">{P.city}</label>
            <select id="city" name="city" defaultValue="tokyo" className={field}>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name[locale]}</option>)}
            </select></div>
        </div>
        <div><label className={label} htmlFor="address">{P.address}</label><input id="address" name="address" required className={field} autoComplete="street-address" /></div>
        <div>
          <label className={label} htmlFor="mapsUrl">{P.mapsLink}</label>
          <input id="mapsUrl" name="mapsUrl" type="url" required inputMode="url" placeholder="https://maps.app.goo.gl/…" className={field} />
          <p className="text-xs text-muted mt-1">{P.mapsHint}</p>
        </div>
      </section>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="agree" required className="mt-1 h-4 w-4 accent-primary" />
        <span>{P.agree}</span>
      </label>

      {state.error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{state.error}</p>}
      <SubmitButton className="w-full">{P.submit}</SubmitButton>
    </form>
  );
}
