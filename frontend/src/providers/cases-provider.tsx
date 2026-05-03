"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CaseSummary } from "@/lib/api/types";

type CasesContextValue = {
  cases: CaseSummary[];
  activeCaseId: string | null;
  setActiveCaseId: (id: string) => void;
  createCase: () => void;
  activeCase: CaseSummary | null;
};

const CasesContext = createContext<CasesContextValue | null>(null);

function formatCaseLabel(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Stable seed data — do not use `new Date()` here (SSR vs client would mismatch). */
const initialCases: CaseSummary[] = [
  {
    id: "case-1",
    label: "Goat — fever & blisters",
    animalType: "goat",
    updatedAt: "2024-01-15T12:00:00.000Z",
  },
];

export function CasesProvider({ children }: { children: ReactNode }) {
  const [cases, setCases] = useState<CaseSummary[]>(initialCases);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(
    initialCases[0]?.id ?? null,
  );

  const createCase = useCallback(() => {
    const id = `case-${
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Date.now().toString(36)
    }`;
    const next: CaseSummary = {
      id,
      label: `New case — ${formatCaseLabel(new Date())}`,
      updatedAt: new Date().toISOString(),
    };
    setCases((prev) => [next, ...prev]);
    setActiveCaseId(id);
  }, []);

  const value = useMemo<CasesContextValue>(
    () => ({
      cases,
      activeCaseId,
      setActiveCaseId,
      createCase,
      activeCase: cases.find((c) => c.id === activeCaseId) ?? null,
    }),
    [cases, activeCaseId, createCase],
  );

  return (
    <CasesContext.Provider value={value}>{children}</CasesContext.Provider>
  );
}

export function useCases() {
  const ctx = useContext(CasesContext);
  if (!ctx) {
    throw new Error("useCases must be used within CasesProvider");
  }
  return ctx;
}
