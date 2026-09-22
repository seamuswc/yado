"use client";

import { useState } from "react";
import { mintApiKey, renameApiKeyAction, revokeApiKeyAction } from "@/actions/api-keys";

type KeyRow = { id: string; token: string | null; prefix: string; label: string };
type Copy = {
  title: string;
  guestBody: string;
  partnerBody: string;
  create: string;
  once: string;
  copy: string;
  copied: string;
  label: string;
  labelPlaceholder: string;
  save: string;
  revoke: string;
  error: string;
};

export default function ApiKeyPanel({ audience, specUrl, keys: initialKeys, copy }: {
  audience: "guest" | "partner";
  specUrl: string;
  keys: KeyRow[];
  copy: Copy;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
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
    if (res.key) setKeys((rows) => [...rows, res.key!]);
  }

  async function copyToken(id: string, value: string) {
    const field = document.getElementById(`api-key-${id}`) as HTMLInputElement | null;
    field?.focus();
    field?.select();
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      document.execCommand("copy");
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
  }

  function onLabel(id: string, label: string) {
    setKeys((rows) => rows.map((k) => (k.id === id ? { ...k, label } : k)));
  }

  async function saveLabel(id: string, label: string) {
    await renameApiKeyAction(id, label);
  }

  async function onRevoke(id: string) {
    await revokeApiKeyAction(id);
    setKeys((rows) => rows.filter((k) => k.id !== id));
    if (copiedId === id) setCopiedId(null);
  }

  return (
    <section className="rounded-2xl bg-card border border-line p-4 space-y-3">
      <h2 className="font-semibold">{copy.title}</h2>
      <p className="text-sm text-muted">{audience === "guest" ? copy.guestBody : copy.partnerBody}</p>
      <a href={specUrl} className="block text-xs text-primary underline break-all">{specUrl}</a>
      {keys.length > 0 && <p className="text-sm text-muted">{copy.once}</p>}
      {keys.length > 0 && (
        <ul className="space-y-3">
          {keys.map((k) => (
            <li key={k.id} className="rounded-xl border border-line bg-paper p-2 space-y-2">
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const label = String(new FormData(e.currentTarget).get("label") ?? "");
                  onLabel(k.id, label);
                  saveLabel(k.id, label);
                }}
              >
                <input
                  name="label"
                  aria-label={copy.label}
                  value={k.label}
                  maxLength={40}
                  placeholder={copy.labelPlaceholder}
                  onChange={(e) => onLabel(k.id, e.target.value)}
                  onBlur={(e) => saveLabel(k.id, e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-line bg-card px-2 py-2 text-sm"
                />
                <button type="submit" className="shrink-0 text-xs font-semibold text-primary min-h-10 px-1">{copy.save}</button>
                <button type="button" onClick={() => onRevoke(k.id)} className="shrink-0 text-xs text-muted underline min-h-10 px-1">{copy.revoke}</button>
              </form>
              {k.token ? (
                <>
                  <input id={`api-key-${k.id}`} readOnly value={k.token} onFocus={(e) => e.target.select()} className="w-full rounded-lg bg-card border border-line px-2 py-2 font-mono text-sm" />
                  <button type="button" onClick={() => copyToken(k.id, k.token!)} className="w-full min-h-12 rounded-xl bg-primary text-white font-semibold">{copy.copy}</button>
                  <p aria-live="polite" className={`text-center text-xs text-muted min-h-4 transition-opacity ${copiedId === k.id ? "opacity-100" : "opacity-0"}`}>{copy.copied}</p>
                </>
              ) : (
                <p className="font-mono text-xs text-muted px-1">{k.prefix}…</p>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={onCreate} className="space-y-2">
        <label htmlFor="api-key-label" className="block text-xs font-medium text-muted">{copy.label}</label>
        <input id="api-key-label" name="label" placeholder={copy.labelPlaceholder} maxLength={40} className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-base" />
        <button type="submit" disabled={pending} className="w-full min-h-12 rounded-xl bg-primary text-white font-semibold disabled:opacity-60">{copy.create}</button>
      </form>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
