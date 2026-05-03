"use client";

import { useCallback, useEffect, useState } from "react";
import { MapPin, X } from "lucide-react";
import type { OutbreakReportPayload } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export type OutbreakLocationDraft = {
  assistantMessageId: string;
  payload: OutbreakReportPayload;
};

type Props = {
  draft: OutbreakLocationDraft | null;
  onClose: () => void;
  /** Return true if the report was sent successfully. */
  onSubmitManual: (locationName: string) => Promise<boolean>;
  /** Return true if location was obtained and the report was sent. */
  onRetryGeo: () => Promise<boolean>;
};

export function OutbreakLocationFallbackDialog({
  draft,
  onClose,
  onSubmitManual,
  onRetryGeo,
}: Props) {
  const open = draft !== null;
  const [area, setArea] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setArea("");
      setHint(null);
      setBusy(false);
    }
  }, [open, draft?.assistantMessageId]);

  const handleManual = useCallback(async () => {
    const t = area.trim();
    if (t.length < 2) {
      setHint("Please enter at least a district, tehsil, or nearby town (English or Urdu is fine).");
      return;
    }
    setBusy(true);
    setHint(null);
    try {
      const ok = await onSubmitManual(t);
      if (ok) onClose();
      else setHint("Could not send. Check your connection and try again.");
    } catch {
      setHint("Could not send. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }, [area, onClose, onSubmitManual]);

  const handleRetry = useCallback(async () => {
    setBusy(true);
    setHint(null);
    try {
      const ok = await onRetryGeo();
      if (ok) onClose();
      else setHint("Location is still unavailable. Type an area below instead.");
    } finally {
      setBusy(false);
    }
  }, [onClose, onRetryGeo]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="outbreak-loc-title"
    >
      <div
        className={cn(
          "relative w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl",
        )}
      >
        <button
          type="button"
          onClick={() => !busy && onClose()}
          className="absolute right-4 top-4 rounded-lg p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-muted text-brand">
          <MapPin className="h-5 w-5" strokeWidth={2} />
        </div>

        <h2
          id="outbreak-loc-title"
          className="pr-10 text-lg font-semibold text-neutral-900"
        >
          Rough location needed
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          Outbreak alerts group reports by <strong>animal</strong>, <strong>symptoms</strong>, and{" "}
          <strong>area</strong>. Without GPS we still need a place name (district, tehsil, or nearest
          town) so your report can count toward the right local cluster.
        </p>

        <div className="mt-5">
          <label
            className="block text-xs font-medium text-neutral-500"
            htmlFor="outbreak-area"
          >
            Your area
          </label>
          <input
            id="outbreak-area"
            type="text"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            disabled={busy}
            placeholder="e.g. Kasur district, or village near Lahore"
            className={cn(
              "mt-1.5 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm",
              "outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/25",
              busy && "opacity-60",
            )}
            autoComplete="address-level2"
          />
        </div>

        {hint ? <p className="mt-2 text-xs text-amber-800">{hint}</p> : null}

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleManual()}
            className={cn(
              "w-full min-h-11 shrink-0 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-brand-foreground",
              "transition hover:opacity-95 active:opacity-90 disabled:opacity-50",
            )}
          >
            Submit with this area
          </button>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleRetry()}
              className={cn(
                "min-h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-medium text-neutral-800",
                "transition hover:bg-neutral-50 disabled:opacity-50",
              )}
            >
              Try device location again
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className={cn(
                "min-h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-medium text-neutral-700",
                "transition hover:bg-neutral-50 disabled:opacity-50",
              )}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
