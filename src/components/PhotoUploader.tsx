"use client";

import { useRef, useState } from "react";

type Labels = { upload: string; uploading: string; remove: string; hint: string; linksLabel: string; linksHint: string };

/**
 * Photo list for a listing: upload from the phone or paste links. The result is one hidden
 * `images` field (one URL per line), the same shape the server already reads.
 */
export default function PhotoUploader({ hotelId, initial, max, labels }: { hotelId?: string; initial: string[]; max: number; labels: Labels }) {
  const [urls, setUrls] = useState<string[]>(initial);
  const [links, setLinks] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pasted = links.split(/\r?\n/).map((s) => s.trim()).filter((s) => /^https:\/\/\S+$/.test(s));
  const all = [...urls, ...pasted.filter((u) => !urls.includes(u))].slice(0, max);

  async function onFiles(files: FileList | null) {
    if (!files || !files.length || !hotelId) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("hotelId", hotelId);
    form.set("existing", String(all.length));
    for (const f of Array.from(files)) form.append("files", f);
    try {
      const res = await fetch("/api/partner/photos", { method: "POST", body: form });
      const data = (await res.json()) as { urls?: string[]; errors?: string[]; error?: string };
      if (!res.ok) setError(data.error ?? "Upload failed.");
      if (data.urls?.length) setUrls((cur) => [...cur, ...data.urls!].slice(0, max));
      if (data.errors?.length) setError(data.errors.join(" "));
    } catch {
      setError("Upload failed.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name="images" value={all.join("\n")} />
      {all.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {all.map((u) => (
            <li key={u} className="relative aspect-[4/3] overflow-hidden rounded-lg border border-line bg-paper">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label={labels.remove}
                onClick={() => { setUrls((cur) => cur.filter((x) => x !== u)); setLinks((cur) => cur.split(/\r?\n/).filter((l) => l.trim() !== u).join("\n")); }}
                className="absolute right-1 top-1 h-7 w-7 rounded-full bg-black/60 text-white text-sm leading-none"
              >×</button>
            </li>
          ))}
        </ul>
      )}
      {hotelId ? (
        <>
          <input ref={fileRef} id="photo-files" type="file" accept="image/*" multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} disabled={busy || all.length >= max} />
          <label htmlFor="photo-files" className={`block w-full rounded-xl border border-dashed border-line py-3 text-center text-sm font-medium ${busy || all.length >= max ? "text-muted" : "text-primary cursor-pointer"}`}>
            {busy ? labels.uploading : `📷 ${labels.upload}`}
          </label>
          <p className="text-xs text-muted">{labels.hint.replace("{max}", String(max))}</p>
        </>
      ) : null}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted">{labels.linksLabel}</summary>
        <textarea rows={3} value={links} onChange={(e) => setLinks(e.target.value)} className="mt-2 w-full rounded-xl border border-line bg-card px-3 py-2 text-base font-mono focus:outline-none focus:ring-2 focus:ring-primary/40" placeholder="https://…" />
        <p className="text-xs text-muted mt-1">{labels.linksHint}</p>
      </details>
      {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
    </div>
  );
}
