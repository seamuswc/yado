"use client";

import { useFormStatus } from "react-dom";

export default function SubmitButton({ children, className = "", secondary = false, name, value, disabled = false }: { children: React.ReactNode; className?: string; secondary?: boolean; name?: string; value?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  const base = secondary
    ? "rounded-xl border border-line bg-card font-semibold py-3 px-4 active:bg-primary-soft"
    : "rounded-xl bg-primary text-white font-semibold py-3 px-4 active:bg-primary-dark";
  return (
    <button type="submit" name={name} value={value} disabled={pending || disabled} className={`${base} disabled:opacity-60 ${className}`}>
      {pending ? "…" : children}
    </button>
  );
}
