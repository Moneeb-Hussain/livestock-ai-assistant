import type { CaseSummary, NormalizedChatResponse } from "@/lib/api/types";
import { newTurnId, parsePersistedChatItem, type PersistedChatItem } from "@/lib/thread-format";

export const WORKSPACE_STORAGE_KEY = "maweshiai.workspace.v2";

const LEGACY_CASES_KEY = "maweshiai.cases.v1";
const LEGACY_CHAT_KEY = "maweshiai.chatByCase.v1";

export type WorkspaceV2 = {
  version: 2;
  activeCaseId: string | null;
  cases: CaseSummary[];
  /** Each case id maps to ordered turns (canonical chat_history + UI times). */
  threads: Record<string, PersistedChatItem[]>;
};

/** Cases with no messages are omitted so empty “New case” drafts are not persisted. */
export function workspaceForPersistence(workspace: WorkspaceV2): WorkspaceV2 {
  const kept = workspace.cases.filter(
    (c) => (workspace.threads[c.id] ?? []).length > 0,
  );
  const threads: Record<string, PersistedChatItem[]> = {};
  for (const c of kept) {
    threads[c.id] = workspace.threads[c.id] ?? [];
  }
  let activeCaseId = workspace.activeCaseId;
  if (!activeCaseId || !kept.some((c) => c.id === activeCaseId)) {
    activeCaseId = kept[0]?.id ?? null;
  }
  return { version: 2, activeCaseId, cases: kept, threads };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCaseSummary(value: unknown): CaseSummary | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.label !== "string") return null;
  if (typeof value.updatedAt !== "string") return null;
  const animalType =
    typeof value.animalType === "string" ? value.animalType : undefined;
  return { id: value.id, label: value.label, updatedAt: value.updatedAt, animalType };
}

function isNormalizedChatResponse(value: unknown): value is NormalizedChatResponse {
  if (!isRecord(value)) return false;
  const rt = value.responseType;
  if (rt !== "medical" && rt !== "non_medical" && rt !== "false_input") return false;
  if (typeof value.chatReply !== "string") return false;
  if (!Array.isArray(value.possibleConditions)) return false;
  if (!Array.isArray(value.careSteps)) return false;
  if (typeof value.disclaimer !== "string") return false;
  return true;
}

function newCaseId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `case-${crypto.randomUUID()}`;
  }
  return `case-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyWorkspace(): WorkspaceV2 {
  const id = newCaseId();
  const now = new Date().toISOString();
  return {
    version: 2,
    activeCaseId: id,
    cases: [{ id, label: "New conversation", updatedAt: now }],
    threads: { [id]: [] },
  };
}

function parseWorkspaceV2(raw: unknown): WorkspaceV2 | null {
  if (!isRecord(raw) || raw.version !== 2) return null;
  if (!Array.isArray(raw.cases)) return null;
  const cases: CaseSummary[] = [];
  for (const item of raw.cases) {
    const c = parseCaseSummary(item);
    if (c) cases.push(c);
  }
  const threads: Record<string, PersistedChatItem[]> = {};
  if (isRecord(raw.threads)) {
    for (const [caseId, list] of Object.entries(raw.threads)) {
      if (!Array.isArray(list)) continue;
      const row: PersistedChatItem[] = [];
      for (const entry of list) {
        const m = parsePersistedChatItem(entry);
        if (m) row.push(m);
      }
      threads[caseId] = row;
    }
  }
  for (const c of cases) {
    if (!threads[c.id]) threads[c.id] = [];
  }
  /** Never surface case rows with no persisted turns (cleans older saves that listed empty cases). */
  const casesWithMessages = cases.filter((c) => (threads[c.id] ?? []).length > 0);
  const trimmedThreads: Record<string, PersistedChatItem[]> = {};
  for (const c of casesWithMessages) {
    trimmedThreads[c.id] = threads[c.id] ?? [];
  }
  if (casesWithMessages.length === 0) {
    return { version: 2, activeCaseId: null, cases: [], threads: {} };
  }
  let activeCaseId: string | null = null;
  if (
    typeof raw.activeCaseId === "string" &&
    casesWithMessages.some((c) => c.id === raw.activeCaseId)
  ) {
    activeCaseId = raw.activeCaseId;
  } else {
    activeCaseId = casesWithMessages[0].id;
  }
  return { version: 2, activeCaseId, cases: casesWithMessages, threads: trimmedThreads };
}

type LegacyUiMessage =
  | {
      id: string;
      role: "user";
      text: string;
      time: string;
      images?: string[];
    }
  | {
      id: string;
      role: "assistant";
      time: string;
      data: NormalizedChatResponse;
    };

function legacyUiToThread(messages: LegacyUiMessage[]): PersistedChatItem[] {
  const out: PersistedChatItem[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      const imageCount = m.images?.length ?? 0;
      out.push({
        id: m.id.startsWith("u-") ? m.id : newTurnId("u"),
        role: "user",
        content: m.text,
        time: m.time,
        ...(imageCount > 0 ? { imageCount } : {}),
      });
      continue;
    }
    out.push({
      id: m.id.startsWith("a-") ? m.id : newTurnId("a"),
      role: "assistant",
      time: m.time,
      content: JSON.stringify(m.data),
    });
  }
  return out;
}

function tryMigrateFromV1(): WorkspaceV2 | null {
  if (typeof window === "undefined") return null;
  try {
    const casesRaw = window.localStorage.getItem(LEGACY_CASES_KEY);
    const chatRaw = window.localStorage.getItem(LEGACY_CHAT_KEY);
    if (!casesRaw && !chatRaw) return null;

    let cases: CaseSummary[] = [];
    let activeCaseId: string | null = null;

    if (casesRaw) {
      const parsed = JSON.parse(casesRaw) as unknown;
      if (isRecord(parsed) && Array.isArray(parsed.cases)) {
        for (const item of parsed.cases) {
          const c = parseCaseSummary(item);
          if (c) cases.push(c);
        }
        if (typeof parsed.activeCaseId === "string") {
          activeCaseId = parsed.activeCaseId;
        }
      }
    }

    const threads: Record<string, PersistedChatItem[]> = {};

    if (chatRaw) {
      const parsed = JSON.parse(chatRaw) as unknown;
      if (isRecord(parsed)) {
        for (const [caseId, list] of Object.entries(parsed)) {
          if (!Array.isArray(list)) continue;
          const row: LegacyUiMessage[] = [];
          for (const item of list) {
            if (!isRecord(item) || typeof item.id !== "string" || typeof item.time !== "string") {
              continue;
            }
            if (item.role === "user" && typeof item.text === "string") {
              row.push({
                id: item.id,
                role: "user",
                text: item.text,
                time: item.time,
                images: Array.isArray(item.images)
                  ? (item.images as unknown[]).map(String)
                  : undefined,
              });
              continue;
            }
            if (
              item.role === "assistant" &&
              isRecord(item.data) &&
              isNormalizedChatResponse(item.data)
            ) {
              row.push({
                id: item.id,
                role: "assistant",
                time: item.time,
                data: item.data,
              });
            }
          }
          threads[caseId] = legacyUiToThread(row);
        }
      }
    }

    if (cases.length === 0) {
      const ids = Object.keys(threads);
      if (ids.length === 0) return null;
      const now = new Date().toISOString();
      cases = ids.map((id) => ({
        id,
        label: id === "local-chat" ? "Conversation" : `Case — ${id.slice(0, 8)}`,
        updatedAt: now,
      }));
    }

    if (!activeCaseId || !cases.some((c) => c.id === activeCaseId)) {
      activeCaseId = cases[0].id;
    }

    for (const c of cases) {
      if (!threads[c.id]) threads[c.id] = [];
    }

    const workspace: WorkspaceV2 = {
      version: 2,
      activeCaseId,
      cases,
      threads,
    };

    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
    window.localStorage.removeItem(LEGACY_CASES_KEY);
    window.localStorage.removeItem(LEGACY_CHAT_KEY);
    return workspace;
  } catch {
    return null;
  }
}

export function loadWorkspace(): WorkspaceV2 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (raw) {
      const parsed = parseWorkspaceV2(JSON.parse(raw) as unknown);
      if (parsed) return parsed;
    }
    return tryMigrateFromV1();
  } catch {
    return tryMigrateFromV1();
  }
}

export function saveWorkspace(workspace: WorkspaceV2): void {
  if (typeof window === "undefined") return;
  try {
    const toSave = workspaceForPersistence(workspace);
    if (toSave.cases.length === 0) {
      window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    /* quota / private mode */
  }
}
