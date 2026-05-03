import { apiFetch } from "@/lib/api/client";
import type { OutbreakReportPayload } from "@/lib/api/types";

export async function reportOutbreakSignal(
  payload: OutbreakReportPayload,
): Promise<{ ok: boolean; id?: string }> {
  return apiFetch("/api/outbreaks", { method: "POST", body: payload });
}
