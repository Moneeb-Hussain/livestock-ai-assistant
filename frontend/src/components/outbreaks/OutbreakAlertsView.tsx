"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  ChevronDown,
  MapPin,
  Radio,
  Users,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { fetchOutbreakAlerts } from "@/lib/api/outbreaks";
import type { OutbreakAlertRow } from "@/lib/api/types";
import {
  formatOutbreakAlertDescription,
  formatOutbreakAlertTitle,
  parseSymptomForDisplay,
} from "@/lib/outbreak-alerts";
import { useOutbreakAlertsRealtime } from "@/hooks/use-outbreak-alerts-realtime";
import { cn } from "@/lib/utils";

function sortByNewest(a: OutbreakAlertRow, b: OutbreakAlertRow): number {
  const ta = a.created_at ? Date.parse(a.created_at) : 0;
  const tb = b.created_at ? Date.parse(b.created_at) : 0;
  if (tb !== ta) return tb - ta;
  return b.id.localeCompare(a.id);
}

function formatRelative(iso?: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const diffSec = Math.round((Date.now() - t) / 1000);
  if (diffSec < 45) return "Just now";
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return rtf.format(-diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 48) return rtf.format(-diffHr, "hour");
  const diffDay = Math.round(diffHr / 24);
  return rtf.format(-diffDay, "day");
}

function riskStyles(risk: string): { label: string; className: string } {
  const r = risk.toLowerCase();
  if (r === "confirmed") {
    return {
      label: "Confirmed",
      className: "bg-red-50 text-red-900 ring-1 ring-red-100",
    };
  }
  if (r === "likely") {
    return {
      label: "Likely",
      className: "bg-amber-50 text-amber-950 ring-1 ring-amber-100",
    };
  }
  return {
    label: "Possible",
    className: "bg-sky-50 text-sky-950 ring-1 ring-sky-100",
  };
}

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-neutral-200/85 motion-reduce:animate-none motion-reduce:bg-neutral-200",
        className,
      )}
      aria-hidden
    />
  );
}

function OutbreakAlertSkeletonCard() {
  return (
    <div
      className="rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm"
      aria-hidden
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 pb-4">
        <div className="min-w-0 flex-1 space-y-2.5">
          <SkeletonBar className="h-6 w-[40%] max-w-[180px]" />
          <SkeletonBar className="h-4 w-[75%] max-w-[320px]" />
        </div>
        <SkeletonBar className="h-7 w-[5.5rem] shrink-0 rounded-full" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <SkeletonBar className="h-6 w-20 rounded-full" />
        <SkeletonBar className="h-6 w-24 rounded-full" />
        <SkeletonBar className="h-6 w-16 rounded-full" />
      </div>
      <SkeletonBar className="mt-4 h-16 w-full rounded-xl" />
    </div>
  );
}

function OutbreakAlertsLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading outbreak clusters">
      <p className="text-sm text-neutral-500">Loading latest clusters…</p>
      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <li key={i}>
            <OutbreakAlertSkeletonCard />
          </li>
        ))}
      </ul>
    </div>
  );
}

const NOTE_CLAMP_CHARS = 320;

function OutbreakAlertCard({ alert: a }: { alert: OutbreakAlertRow }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const risk = riskStyles(a.risk_level);
  const when = formatRelative(a.updated_at || a.created_at);
  const parsed = useMemo(
    () => parseSymptomForDisplay(a.symptom_group),
    [a.symptom_group],
  );
  const note = parsed.farmerNote;
  const noteNeedsToggle = note != null && note.length > NOTE_CLAMP_CHARS;
  const noteDisplay =
    note && noteNeedsToggle && !noteOpen
      ? `${note.slice(0, NOTE_CLAMP_CHARS).trim()}…`
      : note;

  const hasKeywords = parsed.keywords.length > 0;
  const hasBody = hasKeywords || note != null;

  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm",
        "transition-shadow hover:shadow-md md:p-6",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 pb-4">
        <div className="min-w-0 flex-1 space-y-2">
          <h2 className="text-xl font-semibold capitalize tracking-tight text-neutral-900">
            {a.animal_type}
          </h2>
          <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3">
            <span className="inline-flex items-start gap-2 text-sm font-medium leading-snug text-neutral-800">
              <MapPin
                className="mt-0.5 h-4 w-4 shrink-0 text-brand/80"
                strokeWidth={2}
                aria-hidden
              />
              <span>{a.location_name?.trim() || "Area not specified"}</span>
            </span>
            {when ? (
              <time
                className="text-xs font-medium uppercase tracking-wide text-neutral-500 sm:text-sm sm:normal-case sm:tracking-normal"
                dateTime={a.updated_at || a.created_at || undefined}
              >
                {when}
              </time>
            ) : null}
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-3 py-1 text-xs font-semibold",
            risk.className,
          )}
        >
          {risk.label}
        </span>
      </div>

      {hasBody ? (
        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4">
          {hasKeywords ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Reported signs
              </p>
              <ul className="mt-2 flex flex-wrap gap-2" aria-label="Symptom keywords">
                {parsed.keywords.slice(0, 14).map((k, i) => (
                  <li key={`${i}-${k.slice(0, 40)}`}>
                    <span className="inline-block max-w-[220px] truncate rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-800 ring-1 ring-neutral-200/80">
                      {k}
                    </span>
                  </li>
                ))}
                {parsed.keywords.length > 14 ? (
                  <li className="flex items-center">
                    <span className="text-xs font-medium text-neutral-500">
                      +{parsed.keywords.length - 14} more
                    </span>
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}

          {note != null ? (
            <div className="min-h-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Report detail
              </p>
              <div
                className={cn(
                  "mt-1.5 rounded-xl border border-neutral-200/80 bg-neutral-50/90 px-3.5 py-3 text-sm leading-relaxed text-neutral-700",
                  noteNeedsToggle && !noteOpen && "max-h-[11rem] overflow-hidden",
                )}
              >
                <p className="whitespace-pre-wrap break-words">{noteDisplay}</p>
              </div>
              {noteNeedsToggle ? (
                <button
                  type="button"
                  onClick={() => setNoteOpen((o) => !o)}
                  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
                >
                  {noteOpen ? "Show less" : "Read full report"}
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      noteOpen && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-sm text-neutral-500">No symptom summary stored.</p>
      )}

      <div className="mt-auto border-t border-neutral-100 pt-3">
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500">
          <Users className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
          {a.case_count === 1
            ? "1 matching report · 48h window"
            : `${a.case_count} matching reports · 48h window`}
        </p>
      </div>
    </article>
  );
}

const shell = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";

export function OutbreakAlertsView() {
  const [alerts, setAlerts] = useState<OutbreakAlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const res = await fetchOutbreakAlerts();
        if (cancelled) return;
        if (!res.success) {
          setFetchError("Could not load alerts.");
          setAlerts([]);
          return;
        }
        setAlerts([...res.alerts].sort(sortByNewest));
      } catch {
        if (!cancelled) {
          setFetchError("Could not load alerts. Check your connection.");
          setAlerts([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onInsert = useCallback((row: OutbreakAlertRow) => {
    toast.success("New outbreak alert", {
      description: formatOutbreakAlertTitle(row),
      icon: <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />,
    });
    setAlerts((prev) => {
      if (prev.some((a) => a.id === row.id)) return prev;
      return [row, ...prev].sort(sortByNewest);
    });
  }, []);

  const onUpdate = useCallback((row: OutbreakAlertRow) => {
    toast.message("Alert cluster updated", {
      description: `${formatOutbreakAlertTitle(row)} — ${formatOutbreakAlertDescription(row)}`,
    });
    setAlerts((prev) => {
      const idx = prev.findIndex((a) => a.id === row.id);
      if (idx === -1) return [row, ...prev].sort(sortByNewest);
      const next = [...prev];
      next[idx] = row;
      return next;
    });
  }, []);

  const realtimeStatus = useOutbreakAlertsRealtime({
    enabled: !loading,
    onInsert,
    onUpdate,
  });

  const statusLine = useMemo(() => {
    if (realtimeStatus === "no_config") {
      return {
        tone: "muted" as const,
        icon: WifiOff,
        text: "Live updates off — set Supabase URL + anon key in frontend/.env.local, then restart dev.",
      };
    }
    if (realtimeStatus === "error") {
      return {
        tone: "warn" as const,
        icon: WifiOff,
        text: "Live feed unavailable. List below is from the last server fetch.",
      };
    }
    if (realtimeStatus === "connecting") {
      return {
        tone: "info" as const,
        icon: Radio,
        text: "Connecting to live updates…",
      };
    }
    if (realtimeStatus === "subscribed") {
      return {
        tone: "live" as const,
        icon: Activity,
        text: "Live — new clusters appear here and as a toast.",
      };
    }
    return null;
  }, [realtimeStatus]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-neutral-50/90">
      <header className="shrink-0 border-b border-neutral-200/70 bg-white">
        <div className={cn(shell, "py-8 lg:py-10")}>
          <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-10">
            <div className="lg:col-span-7">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Community signals
              </p>
              <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
                Outbreak alerts
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-600">
                Same animal, overlapping symptoms, same area within 48 hours —
                grouped so you can spot local pressure early.
              </p>
            </div>

            <div className="mt-8 rounded-2xl border border-neutral-200/90 bg-neutral-50/90 p-4 sm:p-5 lg:col-span-5 lg:mt-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Summary
                </p>
                {loading ? (
                  <div
                    className="flex h-8 min-w-[6.5rem] items-center justify-center gap-2 rounded-full bg-white px-3 shadow-sm"
                    aria-hidden
                  >
                    <SkeletonBar className="h-3.5 w-3.5 shrink-0 rounded-full" />
                    <SkeletonBar className="h-3 w-12 rounded-full" />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold tabular-nums text-neutral-800 shadow-sm ring-1 ring-neutral-200/80">
                    <Bell className="h-3.5 w-3.5 text-brand" strokeWidth={2} aria-hidden />
                    {alerts.length} cluster{alerts.length === 1 ? "" : "s"}
                  </div>
                )}
              </div>

              {statusLine ? (
                <div
                  className={cn(
                    "mt-4 flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-xs leading-snug sm:text-sm",
                    statusLine.tone === "live" &&
                      "bg-emerald-50/95 text-emerald-950 ring-1 ring-emerald-100",
                    statusLine.tone === "info" &&
                      "bg-white text-neutral-800 ring-1 ring-neutral-200/80",
                    statusLine.tone === "muted" &&
                      "bg-white text-neutral-600 ring-1 ring-neutral-200/70",
                    statusLine.tone === "warn" &&
                      "bg-amber-50/95 text-amber-950 ring-1 ring-amber-100",
                  )}
                >
                  <statusLine.icon
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      statusLine.tone === "live" && "text-emerald-600",
                      statusLine.tone === "info" && "text-neutral-500",
                      statusLine.tone === "muted" && "text-neutral-400",
                      statusLine.tone === "warn" && "text-amber-700",
                    )}
                    strokeWidth={2}
                    aria-hidden
                  />
                  <p className="min-w-0 flex-1">{statusLine.text}</p>
                  {statusLine.tone === "live" ? (
                    <span
                      className="mt-1 inline-flex h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500"
                      title="Subscribed"
                      aria-hidden
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className={cn(shell, "py-6 sm:py-8 lg:py-10")}>
          <div className="mx-auto max-w-6xl">
            {loading ? (
              <OutbreakAlertsLoading />
            ) : fetchError ? (
              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 px-5 py-6 text-center text-sm text-amber-950">
                {fetchError}
              </div>
            ) : alerts.length === 0 ? (
              <div className="mx-auto max-w-lg rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm sm:p-8">
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:text-left">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-muted text-brand">
                    <Bell className="h-7 w-7" strokeWidth={1.5} aria-hidden />
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-900">No clusters yet</p>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                      When enough similar reports arrive for one area, they will
                      show here. Enable live updates for instant toasts.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
                {alerts.map((a) => (
                  <li key={a.id}>
                    <OutbreakAlertCard alert={a} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
