"use client";

import { useActionState } from "react";
import type { ActionState } from "@/actions/auth";
import type { Dictionary, Locale } from "@/lib/i18n";
import SubmitButton from "./SubmitButton";

/** Asks Yado to change a registered detail. The partner cannot change it directly. */
export default function ChangeRequestForm({ locale, dict, hotelId, action }: {
  locale: Locale; dict: Dictionary; hotelId: string;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(action, {});
  const P = dict.partner;
  const field = "w-full rounded-xl border border-line bg-card px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-primary/40";
  const label = "block text-xs font-medium text-muted mb-1";
  const fields: { id: "name" | "type" | "city" | "address" | "pin" | "other"; label: string }[] = [
    { id: "name", label: P.hotelName },
    { id: "type", label: P.type },
    { id: "city", label: P.city },
    { id: "address", label: P.address },
    { id: "pin", label: P.mapPin },
    { id: "other", label: P.changeOther },
  ];

  if (state.ok) {
    return <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">{state.message}</p>;
  }

  return (
    <details className="rounded-xl border border-line bg-paper">
      <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium text-primary">{P.requestChange}</summary>
      <form action={formAction} className="px-3 pb-3 space-y-3">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="hotelId" value={hotelId} />
        <div>
          <label className={label} htmlFor={`cr-field-${hotelId}`}>{P.changeWhat}</label>
          <select id={`cr-field-${hotelId}`} name="field" className={field} defaultValue="address">
            {fields.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor={`cr-requested-${hotelId}`}>{P.changeTo}</label>
          <input id={`cr-requested-${hotelId}`} name="requested" required maxLength={500} className={field} />
        </div>
        <div>
          <label className={label} htmlFor={`cr-reason-${hotelId}`}>{P.changeWhy}</label>
          <textarea id={`cr-reason-${hotelId}`} name="reason" rows={2} maxLength={1000} className={field} />
        </div>
        {state.error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{state.error}</p>}
        <SubmitButton className="w-full">{P.changeSend}</SubmitButton>
      </form>
    </details>
  );
}
