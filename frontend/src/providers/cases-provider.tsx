"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CaseSummary } from "@/lib/api/types";
import type { PersistedChatItem } from "@/lib/thread-format";
import {
  createEmptyWorkspace,
  loadWorkspace,
  saveWorkspace,
  type WorkspaceV2,
} from "@/lib/workspace-storage";

type CasesContextValue = {
  cases: CaseSummary[];
  activeCaseId: string | null;
  setActiveCaseId: (id: string) => void;
  createCase: () => void;
  activeCase: CaseSummary | null;
  /** All case threads keyed by case id (same as localStorage `threads`). */
  threads: Record<string, PersistedChatItem[]>;
  /** Ordered persisted turns for the active case (canonical storage). */
  activeThread: PersistedChatItem[];
  /** Replace entire thread for a case (e.g. after rollback). */
  setThreadForCase: (caseId: string, thread: PersistedChatItem[]) => void;
  /** Append turns and bump case `updatedAt` (and optionally relabel). */
  appendToThread: (
    caseId: string,
    turns: PersistedChatItem[],
    options?: { newLabel?: string },
  ) => void;
  /** After a successful outbreak POST for this case; persists in workspace (one report per chat). */
  markOutbreakReportSubmitted: (caseId: string) => void;
};

const CasesContext = createContext<CasesContextValue | null>(null);

function formatCaseLabel(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function newCaseId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `case-${crypto.randomUUID()}`;
  }
  return `case-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function moveCaseToTop(cases: CaseSummary[], caseId: string): CaseSummary[] {
  const index = cases.findIndex((c) => c.id === caseId);
  if (index <= 0) return cases;
  const next = [...cases];
  const [item] = next.splice(index, 1);
  return [item, ...next];
}

export function CasesProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<WorkspaceV2>(() => createEmptyWorkspace());
  const [persistReady, setPersistReady] = useState(false);

  useEffect(() => {
    const loaded = loadWorkspace();
    if (loaded) {
      if (loaded.cases.length === 0) {
        setWorkspace(createEmptyWorkspace());
      } else {
        setWorkspace(loaded);
      }
    }
    setPersistReady(true);
  }, []);

  useEffect(() => {
    if (!persistReady) return;
    const id = window.setTimeout(() => saveWorkspace(workspace), 0);
    return () => window.clearTimeout(id);
  }, [workspace, persistReady]);

  const setActiveCaseId = useCallback((id: string) => {
    setWorkspace((prev) => ({ ...prev, activeCaseId: id }));
  }, []);

  const createCase = useCallback(() => {
    const id = newCaseId();
    const now = new Date().toISOString();
    const nextCase: CaseSummary = {
      id,
      label: `New case — ${formatCaseLabel(new Date())}`,
      updatedAt: now,
    };
    setWorkspace((prev) => {
      const keptCases = prev.cases.filter(
        (c) => (prev.threads[c.id] ?? []).length > 0,
      );
      const threads: Record<string, PersistedChatItem[]> = {};
      for (const c of keptCases) {
        threads[c.id] = prev.threads[c.id] ?? [];
      }
      return {
        ...prev,
        activeCaseId: id,
        cases: [nextCase, ...keptCases],
        threads: { ...threads, [id]: [] },
      };
    });
  }, []);

  const setThreadForCase = useCallback((caseId: string, thread: PersistedChatItem[]) => {
    setWorkspace((prev) => ({
      ...prev,
      threads: { ...prev.threads, [caseId]: thread },
    }));
  }, []);

  const appendToThread = useCallback(
    (caseId: string, turns: PersistedChatItem[], options?: { newLabel?: string }) => {
      const now = new Date().toISOString();
      setWorkspace((prev) => {
        const prevList = prev.threads[caseId] ?? [];
        const cases = moveCaseToTop(
          prev.cases.map((c) =>
            c.id === caseId
              ? {
                  ...c,
                  updatedAt: now,
                  ...(options?.newLabel ? { label: options.newLabel } : {}),
                }
              : c,
          ),
          caseId,
        );
        return {
          ...prev,
          cases,
          threads: {
            ...prev.threads,
            [caseId]: [...prevList, ...turns],
          },
        };
      });
    },
    [],
  );

  const markOutbreakReportSubmitted = useCallback((caseId: string) => {
    setWorkspace((prev) => ({
      ...prev,
      cases: prev.cases.map((c) =>
        c.id === caseId ? { ...c, outbreakReportSubmitted: true } : c,
      ),
    }));
  }, []);

  const value = useMemo<CasesContextValue>(() => {
    const activeCaseId = workspace.activeCaseId;
    const activeThread =
      activeCaseId && workspace.threads[activeCaseId]
        ? workspace.threads[activeCaseId]
        : [];
    return {
      cases: workspace.cases,
      activeCaseId,
      setActiveCaseId,
      createCase,
      activeCase: workspace.cases.find((c) => c.id === activeCaseId) ?? null,
      threads: workspace.threads,
      activeThread,
      setThreadForCase,
      appendToThread,
      markOutbreakReportSubmitted,
    };
  }, [
    workspace,
    setActiveCaseId,
    createCase,
    setThreadForCase,
    appendToThread,
    markOutbreakReportSubmitted,
  ]);

  return <CasesContext.Provider value={value}>{children}</CasesContext.Provider>;
}

export function useCases() {
  const ctx = useContext(CasesContext);
  if (!ctx) {
    throw new Error("useCases must be used within CasesProvider");
  }
  return ctx;
}
