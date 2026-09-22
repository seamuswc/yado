"use client";

import { useEffect, useState } from "react";

/** A ready-to-paste message for the reader's own assistant, with a copy button. */
export default function PromptExample({ title, intro, text, copy, copied }: {
  title: string;
  intro: string;
  text: string;
  copy: string;
  copied: string;
}) {
  const [flash, setFlash] = useState(0);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setFlash(Date.now());
  }

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(0), 1500);
    return () => clearTimeout(id);
  }, [flash]);

  return (
    <section className="rounded-2xl bg-card border border-line p-4 space-y-3">
      <h2 className="font-semibold">{title}</h2>
      <p className="text-sm text-muted">{intro}</p>
      <pre className="whitespace-pre-wrap break-words rounded-xl bg-paper border border-line px-3 py-2 text-sm leading-relaxed font-sans select-all">{text}</pre>
      <button type="button" onClick={onCopy} className="w-full min-h-12 rounded-xl bg-primary text-white font-semibold">{copy}</button>
      <p aria-live="polite" className={`text-center text-xs text-muted min-h-4 transition-opacity ${flash ? "opacity-100" : "opacity-0"}`}>{copied}</p>
    </section>
  );
}
