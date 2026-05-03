import type { OutbreakAlertRow } from "@/lib/api/types";

function asString(v: unknown, fallback: string): string {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return fallback;
}

function asNumber(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

/** Normalize API / Realtime payloads into `OutbreakAlertRow`. */
export function parseOutbreakAlertRow(raw: unknown): OutbreakAlertRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = o.id;
  if (id == null) return null;
  const idStr = typeof id === "string" ? id : String(id);
  if (!idStr) return null;

  const locRaw = o.location_name;
  let location_name: string | null = null;
  if (locRaw != null && locRaw !== "") {
    const s = typeof locRaw === "string" ? locRaw.trim() : String(locRaw).trim();
    location_name = s || null;
  }

  return {
    id: idStr,
    animal_type: asString(o.animal_type, "livestock"),
    symptom_group: asString(o.symptom_group, ""),
    location_name,
    case_count: asNumber(o.case_count, 0),
    risk_level: asString(o.risk_level, "possible").toLowerCase(),
    created_at: typeof o.created_at === "string" ? o.created_at : null,
    updated_at: typeof o.updated_at === "string" ? o.updated_at : null,
  };
}

export function formatOutbreakAlertTitle(row: OutbreakAlertRow): string {
  const place =
    row.location_name && row.location_name.trim()
      ? row.location_name.trim()
      : "unspecified area";
  const animal = row.animal_type || "Livestock";
  const risk = row.risk_level ? row.risk_level : "possible";
  return `${animal} · ${place} · ${risk} risk`;
}

export function formatOutbreakAlertDescription(row: OutbreakAlertRow): string {
  const n = row.case_count;
  const cases = n === 1 ? "1 report" : `${n} reports`;
  const symptoms = row.symptom_group?.trim() || "Symptoms not listed";
  return `${cases} in 48h window · ${symptoms}`;
}
