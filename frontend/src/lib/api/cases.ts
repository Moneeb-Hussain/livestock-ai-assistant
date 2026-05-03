import { apiFetch } from "@/lib/api/client";
import type { CaseSummary } from "@/lib/api/types";

export async function listCases(): Promise<CaseSummary[]> {
  return apiFetch<CaseSummary[]>("/api/cases", { method: "GET" });
}

export async function createCase(body: {
  label?: string;
  animalType?: string;
}): Promise<CaseSummary> {
  return apiFetch<CaseSummary>("/api/cases", { method: "POST", body });
}
