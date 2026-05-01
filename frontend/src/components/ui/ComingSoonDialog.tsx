"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
};

export function ComingSoonDialog({ open, title, onClose }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="coming-soon-title"
        className={cn(
          "relative w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-lg",
        )}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
          aria-label="Close"
        >
          <X className="h-5 w-5" strokeWidth={2} />
        </button>
        <h2
          id="coming-soon-title"
          className="pr-10 text-lg font-semibold text-neutral-900"
        >
          {title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          Coming soon.
        </p>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "mt-6 w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-brand-foreground",
            "transition hover:opacity-95",
          )}
        >
          OK
        </button>
      </div>
    </div>,
    document.body,
  );
}
