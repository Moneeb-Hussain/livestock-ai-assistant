"use client";

import { Crosshair, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  busy: boolean;
  /** Chrome (and others) already blocked this origin — browser will not show a new prompt until the user resets site settings. */
  showChromeBlockedHelp: boolean;
  onCancel: () => void;
  /** First step: user read intro; then browser asks for location (if not already blocked). */
  onContinue: () => Promise<void>;
  /** After user sets Location → Allow in site settings. */
  onTryAgainAfterUnblock: () => Promise<void>;
  /** Skip GPS and use the manual area dialog instead. */
  onEnterAreaManually: () => void;
};

/**
 * Step 1: explain browser location; Continue triggers `getCurrentPosition`.
 * If the site is already blocked, we explain how to reset Chrome’s “Location access denied”
 * (no second prompt appears until then — that is browser policy, not something we can override).
 */
export function OutbreakLocationPrimerDialog({
  open,
  busy,
  showChromeBlockedHelp,
  onCancel,
  onContinue,
  onTryAgainAfterUnblock,
  onEnterAreaManually,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[101] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="outbreak-primer-title"
    >
      <div
        className={cn(
          "relative w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl",
        )}
      >
        <button
          type="button"
          onClick={() => !busy && onCancel()}
          className="absolute right-4 top-4 rounded-lg p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-muted text-brand">
          <Crosshair className="h-5 w-5" strokeWidth={2} />
        </div>

        {showChromeBlockedHelp ? (
          <>
            <h2
              id="outbreak-primer-title"
              className="pr-10 text-lg font-semibold text-neutral-900"
            >
              Location access denied for this site
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              Chrome is <strong>blocking</strong> this page from using location, so you will{" "}
              <strong>not</strong> see the “Allow location?” bar until you change that setting.
            </p>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-neutral-700">
              <li>
                Click the <strong>tune / lock</strong> icon in the address bar (same place as
                “Location access denied”).
              </li>
              <li>
                Open <strong>Site settings</strong> or <strong>Permissions</strong>.
              </li>
              <li>
                Under <strong>Location</strong>, choose <strong>Allow</strong> for this site (not
                “Continue blocking”).
              </li>
              <li>
                Come back here and tap <strong>Try again</strong>.
              </li>
            </ol>
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void onTryAgainAfterUnblock()}
                className={cn(
                  "rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground",
                  "transition hover:opacity-95 disabled:opacity-50",
                )}
              >
                {busy ? "Checking…" : "Try again"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onEnterAreaManually}
                className={cn(
                  "rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800",
                  "transition hover:bg-neutral-50 disabled:opacity-50",
                )}
              >
                Type my area instead
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onCancel}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <h2
              id="outbreak-primer-title"
              className="pr-10 text-lg font-semibold text-neutral-900"
            >
              Turn on location
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              For outbreak mapping, your browser will ask to use this device&apos;s{" "}
              <strong>approximate location</strong>. Please choose <strong>Allow</strong> when the
              prompt appears.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-neutral-600">
              If you choose <strong>Block</strong> or dismiss it, you&apos;ll be able to type your
              district, tehsil, or nearest town on the next step instead.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={onCancel}
                className={cn(
                  "rounded-xl px-4 py-2.5 text-sm font-medium text-neutral-600",
                  "transition hover:bg-neutral-100 disabled:opacity-50",
                )}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onContinue()}
                className={cn(
                  "rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground",
                  "transition hover:opacity-95 disabled:opacity-50",
                )}
              >
                {busy ? "Waiting for browser…" : "Continue — allow location"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
