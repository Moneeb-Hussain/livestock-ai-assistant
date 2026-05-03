"use client";

import { useEffect, useRef, useState } from "react";
import type { OutbreakAlertRow } from "@/lib/api/types";
import { parseOutbreakAlertRow } from "@/lib/outbreak-alerts";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export type OutbreakRealtimeStatus =
  | "idle"
  | "no_config"
  | "connecting"
  | "subscribed"
  | "error";

type Options = {
  enabled: boolean;
  onInsert: (row: OutbreakAlertRow) => void;
  onUpdate: (row: OutbreakAlertRow) => void;
};

/**
 * Subscribes to `public.outbreak_alerts` INSERT/UPDATE while `enabled` is true.
 * Tear down on unmount or when the user leaves the outbreaks view.
 */
export function useOutbreakAlertsRealtime({
  enabled,
  onInsert,
  onUpdate,
}: Options): OutbreakRealtimeStatus {
  const [status, setStatus] = useState<OutbreakRealtimeStatus>("idle");
  const insertRef = useRef(onInsert);
  const updateRef = useRef(onUpdate);
  insertRef.current = onInsert;
  updateRef.current = onUpdate;

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setStatus("no_config");
      return;
    }

    setStatus("connecting");

    const channel = supabase
      .channel("outbreak-alerts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "outbreak_alerts",
        },
        (payload) => {
          const row = parseOutbreakAlertRow(payload.new);
          if (row) insertRef.current(row);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "outbreak_alerts",
        },
        (payload) => {
          const row = parseOutbreakAlertRow(payload.new);
          if (row) updateRef.current(row);
        },
      )
      .subscribe((subStatus) => {
        if (subStatus === "SUBSCRIBED") setStatus("subscribed");
        else if (subStatus === "CHANNEL_ERROR" || subStatus === "TIMED_OUT") {
          setStatus("error");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
      setStatus("idle");
    };
  }, [enabled]);

  return status;
}
