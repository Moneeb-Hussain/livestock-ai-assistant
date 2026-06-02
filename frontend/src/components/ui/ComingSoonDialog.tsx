"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X } from "lucide-react";
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close dialog"
        className={cn(
          "modal-backdrop-enter absolute inset-0 bg-neutral-950/55",
          "backdrop-blur-md backdrop-saturate-150",
        )}
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="coming-soon-title"
        aria-describedby="coming-soon-desc"
        className={cn(
          "modal-content-enter relative w-full max-w-md overflow-hidden rounded-3xl",
          "bg-white shadow-[0_25px_50px_-12px_rgba(0,0,0,0.18)]",
          "ring-1 ring-neutral-200/90 ring-offset-0",
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute -top-24 left-1/2 h-48 w-[120%] -translate-x-1/2 rounded-full",
            "bg-gradient-to-b from-emerald-400/25 via-emerald-500/10 to-transparent blur-2xl",
          )}
        />

        <button
          type="button"
          onClick={onClose}
          className={cn(
            "absolute right-3 top-3 z-10 rounded-xl p-2",
            "text-neutral-500 transition-colors",
            "hover:bg-neutral-100 hover:text-neutral-900",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
          )}
          aria-label="Close"
        >
          <X className="h-5 w-5" strokeWidth={2} />
        </button>

        <div className="relative px-8 pb-8 pt-12 text-center">
          <div
            className={cn(
              "mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl",
              "bg-gradient-to-br from-brand-muted to-emerald-100/80",
              "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6)]",
              "ring-1 ring-brand/15",
            )}
          >
            <Sparkles
              className="h-8 w-8 text-brand"
              strokeWidth={1.75}
              aria-hidden
            />
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand/90">
            LivestockAI
          </p>
          <h2
            id="coming-soon-title"
            className="mt-2 text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl"
          >
            {title}
          </h2>
          <p
            id="coming-soon-desc"
            className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-neutral-600"
          >
            We&apos;re still polishing this area. It&apos;ll show up here in a
            future update.
          </p>
        </div>

        <div className="border-t border-neutral-100 bg-neutral-50/80 px-8 py-5">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "w-full rounded-2xl bg-brand py-3 text-sm font-semibold text-brand-foreground",
              "shadow-sm transition hover:brightness-105 active:brightness-95",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
            )}
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
