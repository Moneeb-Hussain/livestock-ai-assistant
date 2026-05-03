import { apiFetch } from "@/lib/api/client";
import type {
  OutbreakAlertRow,
  OutbreakReportPayload,
  OutbreakReportResult,
} from "@/lib/api/types";
import { parseOutbreakAlertRow } from "@/lib/outbreak-alerts";

/**
 * Ordered rules aligned with backend `infer_animal_type` keywords (first match wins).
 */
const ANIMAL_TYPE_RULES: { type: string; re: RegExp }[] = [
  { type: "goat", re: /\b(goats?|bakri|bakra)\b/i },
  { type: "cow", re: /\b(cows?|cattle|bovine|gai|gaaye)\b/i },
  { type: "buffalo", re: /\b(buffaloes|buffalo|bhains)\b/i },
  { type: "sheep", re: /\b(sheep|lambs?|bhed)\b/i },
  { type: "camel", re: /\b(camels?|oont)\b/i },
  { type: "chicken", re: /\b(chickens?|murghi|hens?|roosters?)\b/i },
  { type: "calf", re: /\b(calf|calves|bachra)\b/i },
];

/**
 * Infer a concrete animal token from free text (case title, thread excerpt, symptoms).
 * Returns `"unknown"` when nothing matches — avoids sending generic `"livestock"` when the chat names a species.
 */
export function inferAnimalTypeFromChatText(text: string): string {
  const t = text.trim();
  if (!t) return "unknown";
  for (const { type, re } of ANIMAL_TYPE_RULES) {
    if (re.test(t)) return type;
  }
  return "unknown";
}

/** @deprecated Prefer `inferAnimalTypeFromChatText` with full thread excerpt. */
export function inferAnimalTypeFromCaseLabel(label: string | undefined): string {
  return inferAnimalTypeFromChatText(label ?? "");
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

  const explicitAnimal = p.animalType?.trim();
  const inferenceBlob = [
    p.caseLabel,
    ...(p.possibleConditions ?? []).map((s) => s.trim()).filter(Boolean),
    (p.symptomSummary && p.symptomSummary.trim()) || "",
    (p.chatExcerptForAnimal && p.chatExcerptForAnimal.trim()) || "",
  ]
    .filter(Boolean)
    .join("\n");

  const animal_type =
    explicitAnimal || inferAnimalTypeFromChatText(inferenceBlob);

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
