"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  Loader2,
  MapPin,
  Radio,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { fetchOutbreakAlerts } from "@/lib/api/outbreaks";
import type { OutbreakAlertRow } from "@/lib/api/types";
import {
  formatOutbreakAlertDescription,
  formatOutbreakAlertTitle,
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
      className: "bg-red-100 text-red-900 ring-1 ring-red-200/80",
    };
  }
  if (r === "likely") {
    return {
      label: "Likely",
      className: "bg-amber-100 text-amber-950 ring-1 ring-amber-200/80",
    };
  }
  return {
    label: "Possible",
    className: "bg-sky-100 text-sky-950 ring-1 ring-sky-200/80",
  };
}

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

  const statusBanner = useMemo(() => {
    if (realtimeStatus === "no_config") {
      return {
        tone: "muted" as const,
        icon: WifiOff,
        text: "Live updates are off. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) to frontend/.env.local or frontend/src/.env.local — names must start with NEXT_PUBLIC_. Restart `npm run dev` after saving.",
      };
    }
    if (realtimeStatus === "error") {
      return {
        tone: "warn" as const,
        icon: WifiOff,
        text: "Could not subscribe to live updates. Pull to refresh the list, or check Supabase Realtime for outbreak_alerts.",
      };
    }
    if (realtimeStatus === "connecting") {
      return {
        tone: "info" as const,
        icon: Radio,
        text: "Connecting to live outbreak feed…",
      };
    }
    if (realtimeStatus === "subscribed") {
      return {
        tone: "live" as const,
        icon: Activity,
        text: "Listening for new and updated alerts in real time.",
      };
    }
    return null;
  }, [realtimeStatus]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-brand-surface">
      <div className="border-b border-neutral-200/80 bg-white px-5 py-4 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">
              Outbreak alerts
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-neutral-600">
              Aggregated local signals from community reports. New rows appear
              when similar symptoms cluster in the same area within 48 hours.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-700">
            <Bell className="h-3.5 w-3.5 text-brand" strokeWidth={2} />
            {alerts.length} active {alerts.length === 1 ? "cluster" : "clusters"}
          </div>
        </div>

        {statusBanner ? (
          <div
            className={cn(
              "mt-4 flex gap-3 rounded-xl border px-3 py-2.5 text-sm leading-snug",
              statusBanner.tone === "live" &&
                "border-emerald-200 bg-emerald-50/90 text-emerald-950",
              statusBanner.tone === "info" &&
                "border-neutral-200 bg-neutral-50 text-neutral-800",
              statusBanner.tone === "muted" &&
                "border-neutral-200 bg-white text-neutral-600",
              statusBanner.tone === "warn" &&
                "border-amber-200 bg-amber-50/90 text-amber-950",
            )}
          >
            <statusBanner.icon
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                statusBanner.tone === "live" && "text-emerald-600",
                statusBanner.tone === "info" && "text-neutral-500",
                statusBanner.tone === "muted" && "text-neutral-400",
                statusBanner.tone === "warn" && "text-amber-700",
              )}
              strokeWidth={2}
              aria-hidden
            />
            <p>{statusBanner.text}</p>
            {statusBanner.tone === "live" ? (
              <span
                className="ml-auto inline-flex h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500"
                title="Subscribed"
                aria-hidden
              />
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-neutral-500">
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
            <p className="text-sm">Loading alerts…</p>
          </div>
        ) : fetchError ? (
          <div className="mx-auto max-w-md rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-5 text-center text-sm text-amber-950">
            {fetchError}
          </div>
        ) : alerts.length === 0 ? (
          <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-300 bg-white/60 px-6 py-14 text-center">
            <Bell className="h-10 w-10 text-brand/80" strokeWidth={1.5} />
            <p className="text-sm font-medium text-neutral-800">
              No active outbreak clusters
            </p>
            <p className="text-sm text-neutral-600">
              When enough similar reports arrive for the same animal and area,
              they will appear here. You will get a toast if live updates are
              enabled.
            </p>
          </div>
        ) : (
          <ul className="mx-auto flex max-w-3xl flex-col gap-3">
            {alerts.map((a) => {
              const risk = riskStyles(a.risk_level);
              const when = formatRelative(a.updated_at || a.created_at);
              return (
                <li key={a.id}>
                  <article
                    className={cn(
                      "rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-card",
                      "transition hover:border-neutral-300/90",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-base font-semibold capitalize text-neutral-900">
                          {a.animal_type}
                        </h2>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-600">
                          <span className="inline-flex items-center gap-1">
                            <MapPin
                              className="h-3.5 w-3.5 shrink-0 text-neutral-400"
                              aria-hidden
                            />
                            {a.location_name?.trim() || "Area not specified"}
                          </span>
                          {when ? (
                            <>
                              <span className="text-neutral-300" aria-hidden>
                                ·
                              </span>
                              <span className="text-neutral-500">{when}</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          risk.className,
                        )}
                      >
                        {risk.label}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm text-neutral-600">
                      <span className="font-medium text-neutral-700">
                        Symptoms:{" "}
                      </span>
                      {a.symptom_group?.trim() || "—"}
                    </p>
                    <p className="mt-2 text-xs text-neutral-500">
                      {a.case_count === 1
                        ? "1 matching report in window"
                        : `${a.case_count} matching reports in window`}
                    </p>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
