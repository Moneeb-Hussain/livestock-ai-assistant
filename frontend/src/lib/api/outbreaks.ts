import { apiFetch } from "@/lib/api/client";
import type {
  OutbreakAlertRow,
  OutbreakReportPayload,
  OutbreakReportResult,
} from "@/lib/api/types";
import { parseOutbreakAlertRow } from "@/lib/outbreak-alerts";

/**
 * Best-effort animal type from a case title (e.g. "Goat — fever") when `animalType`
 * is not set on the case.
 */
export function inferAnimalTypeFromCaseLabel(label: string | undefined): string {
  if (!label) return "livestock";
  const lower = label.toLowerCase();
  if (/\bgoat\b/.test(lower)) return "goat";
  if (/\bbuffalo\b/.test(lower)) return "buffalo";
  if (/\b(sheep|lamb)\b/.test(lower)) return "sheep";
  if (/\b(cow|cattle|bovine)\b/.test(lower)) return "cow";
  if (/\bcamel\b/.test(lower)) return "camel";
  return "livestock";
}

/**
 * Backend (`OutbreakReportRequest`) expects snake_case: `animal_type`, `symptom_group`, etc.
 * `save_outbreak_report` requires both `animal_type` and `symptom_group` (comma-separated keywords).
 */
function outbreakReportToApiBody(p: OutbreakReportPayload): Record<string, unknown> {
  const symptom_group =
    (p.symptomSummary && p.symptomSummary.trim()) ||
    (p.possibleConditions?.length
      ? p.possibleConditions.map((s) => s.trim()).filter(Boolean).join(",")
      : "unspecified");

  const animal_type =
    (p.animalType && p.animalType.trim()) ||
    inferAnimalTypeFromCaseLabel(p.caseLabel);

  const body: Record<string, unknown> = {
    animal_type,
    symptom_group,
    language: (p.language && p.language.trim()) || "english",
  };

  const firstCond = p.possibleConditions?.find((s) => s.trim());
  if (firstCond) body.possible_condition = firstCond.trim();
  if (p.severity) body.severity = p.severity;
  if (p.locationName) body.location_name = p.locationName;
  if (p.latitude != null) body.latitude = p.latitude;
  if (p.longitude != null) body.longitude = p.longitude;

  return body;
}

export async function reportOutbreakSignal(
  payload: OutbreakReportPayload,
): Promise<OutbreakReportResult> {
  return apiFetch<OutbreakReportResult>("/api/outbreaks", {
    method: "POST",
    body: outbreakReportToApiBody(payload),
  });
}

export async function fetchOutbreakAlerts(): Promise<{
  success: boolean;
  alerts: OutbreakAlertRow[];
}> {
  const res = await apiFetch<{ success?: boolean; alerts?: unknown[] }>(
    "/api/outbreaks",
    { method: "GET" },
  );
  const alerts = (res.alerts ?? [])
    .map((row) => parseOutbreakAlertRow(row))
    .filter((r): r is OutbreakAlertRow => r !== null);
  return { success: Boolean(res.success), alerts };
}
