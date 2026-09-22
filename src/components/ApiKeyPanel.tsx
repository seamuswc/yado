"use client";

import { useState } from "react";
import { mintApiKey, revokeApiKeyAction } from "@/actions/api-keys";

type KeyRow = { id: string; prefix: string; label: string };
type Copy = {
  title: string;
  guestBody: string;
  partnerBody: string;
  create: string;
  once: string;
  label: string;
  revoke: string;
  error: string;
};

export default function ApiKeyPanel({ audience, specUrl, keys: initialKeys, copy }: {
  audience: "guest" | "partner";
  specUrl: string;
  keys: KeyRow[];
  copy: Copy;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [keys, setKeys] = useState(initialKeys);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const label = String(new FormData(e.currentTarget).get("label") ?? "");
    setPending(true);
    setError(null);
    const res = await mintApiKey(label);
    setPending(false);
    if (res.error || !res.token) {
      setError(res.error ?? copy.error);
      return;
    }
    setToken(res.token);
    if (res.key) setKeys((rows) => [...rows, res.key!]);
  }

  async function onRevoke(id: string) {
    await revokeApiKeyAction(id);
    setKeys((rows) => rows.filter((k) => k.id !== id));
    setToken(null);
  }

  return (
    <section className="rounded-2xl bg-card border border-line p-4 space-y-3">
      <h2 className="font-semibold">{copy.title}</h2>
      <p className="text-sm text-muted">{audience === "guest" ? copy.guestBody : copy.partnerBody}</p>
      <a href={specUrl} className="block text-xs text-primary underline break-all">{specUrl}</a>
      {keys.length > 0 && (
        <ul className="space-y-1">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="font-mono truncate">{k.prefix}… {k.label}</span>
              <button type="button" onClick={() => onRevoke(k.id)} className="shrink-0 text-muted underline">{copy.revoke}</button>
            </li>
          ))}
        </ul>
      )}
      {token ? (
        <div className="text-sm">
          <p className="text-muted mb-1">{copy.once}</p>
          <code className="block break-all rounded-lg bg-paper border border-line px-2 py-2 font-mono text-xs">{token}</code>
        </div>
      ) : (
        <form onSubmit={onCreate} className="flex gap-2">
          <input name="label" placeholder={copy.label} maxLength={40} className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-sm" />
          <button type="submit" disabled={pending} className="rounded-xl bg-primary text-white text-sm font-semibold px-3 disabled:opacity-60">{copy.create}</button>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
