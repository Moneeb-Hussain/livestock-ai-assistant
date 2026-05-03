import type { ChatHistoryItem, NormalizedChatResponse } from "@/lib/api/types";

/** One turn persisted for a case (localStorage). Assistant `content` is JSON of the full API payload. */
export type PersistedChatItem =
  | {
      id: string;
      role: "user";
      content: string;
      time: string;
      imageCount?: number;
    }
  | {
      id: string;
      role: "assistant";
      /** `JSON.stringify` of `NormalizedChatResponse` — exact round-trip for UI. */
      content: string;
      time: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNormalizedChatResponse(value: unknown): value is NormalizedChatResponse {
  if (!isRecord(value)) return false;
  const rt = value.responseType;
  if (rt !== "medical" && rt !== "non_medical" && rt !== "false_input") return false;
  if (typeof value.chatReply !== "string") return false;
  if (!Array.isArray(value.possibleConditions)) return false;
  if (!Array.isArray(value.careSteps)) return false;
  if (typeof value.disclaimer !== "string") return false;
  return true;
}

/** Parse assistant `content` JSON back to the structured response used in the UI. */
export function parseAssistantPayload(content: string): NormalizedChatResponse | null {
  try {
    const raw = JSON.parse(content) as unknown;
    return isNormalizedChatResponse(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Latest medical assistant turn in the thread (for treatment plan page). */
export function getLatestMedicalFromThread(
  thread: PersistedChatItem[],
): NormalizedChatResponse | null {
  for (let i = thread.length - 1; i >= 0; i -= 1) {
    const m = thread[i];
    if (m.role !== "assistant") continue;
    const data = parseAssistantPayload(m.content);
    if (data?.responseType === "medical") return data;
  }
  return null;
}

export function threadHasMedicalPlan(thread: PersistedChatItem[]): boolean {
  return getLatestMedicalFromThread(thread) != null;
}

/** Short plain-text summary of an assistant turn for the LLM (not raw JSON). */
export function normalizedToAssistantSummary(data: NormalizedChatResponse): string {
  if (data.responseType === "medical") {
    return [data.chatReply, ...data.careSteps.map((s) => `• ${s}`)].join("\n");
  }
  if (data.responseType === "non_medical") {
    const q = (data.questions ?? []).filter(Boolean).join("; ");
    return [data.chatReply, q && `Follow-up: ${q}`].filter(Boolean).join("\n");
  }
  return data.chatReply;
}

/**
 * History sent to `/api/chat` as `chat_history`: same order as the thread, but assistant
 * rows use human-readable summaries so the model is not flooded with prior JSON schemas.
 */
export function threadToApiChatHistory(thread: PersistedChatItem[]): ChatHistoryItem[] {
  const out: ChatHistoryItem[] = [];
  for (const item of thread) {
    if (item.role === "user") {
      const extra =
        item.imageCount && item.imageCount > 0
          ? ` [${item.imageCount} image(s) sent from the app.]`
          : "";
      const content = `${item.content}${extra}`.trim() || ".";
      out.push({ role: "user", content });
      continue;
    }
    const parsed = parseAssistantPayload(item.content);
    if (parsed) {
      out.push({
        role: "assistant",
        content: normalizedToAssistantSummary(parsed),
      });
    } else {
      out.push({ role: "assistant", content: item.content.slice(0, 2000) });
    }
  }
  return out;
}

const TITLE_MAX = 52;

export function threadTitleFromFirstUserMessage(text: string): string {
  const line = text.replace(/\s+/g, " ").trim();
  if (!line) return "Image message";
  const cut = line.length > TITLE_MAX ? `${line.slice(0, TITLE_MAX - 1).trimEnd()}…` : line;
  return cut;
}

export function isAutoCaseLabel(label: string): boolean {
  return (
    label === "Conversation" ||
    label === "New conversation" ||
    /^New case —/u.test(label)
  );
}

export function newTurnId(prefix: "u" | "a"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function parsePersistedChatItem(value: unknown): PersistedChatItem | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string") return null;
  if (typeof value.time !== "string") return null;
  if (value.role === "user") {
    if (typeof value.content !== "string") return null;
    const imageCount =
      typeof value.imageCount === "number" && value.imageCount > 0
        ? value.imageCount
        : undefined;
    return { id: value.id, role: "user", content: value.content, time: value.time, imageCount };
  }
  if (value.role === "assistant" && typeof value.content === "string") {
    return { id: value.id, role: "assistant", content: value.content, time: value.time };
  }
  return null;
}

export type ChatUiMessage =
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

function imageStorageHint(count: number): string {
  return count === 1
    ? "1 image was sent; the preview is not kept in browser storage."
    : `${count} images were sent; previews are not kept in browser storage.`;
}

/** Render thread in the chat UI (assistant JSON → structured card). */
export function threadToUiMessages(thread: PersistedChatItem[]): ChatUiMessage[] {
  const row: ChatUiMessage[] = [];
  for (const m of thread) {
    if (m.role === "assistant") {
      const data = parseAssistantPayload(m.content);
      if (data) {
        row.push({ id: m.id, role: "assistant", time: m.time, data });
      }
      continue;
    }
    let text = m.content;
    if (m.imageCount && m.imageCount > 0) {
      const hint = imageStorageHint(m.imageCount);
      if (!text.includes("not kept in browser storage")) {
        text = text.trim() ? `${text.trim()}\n${hint}` : hint;
      }
    }
    row.push({
      id: m.id,
      role: "user",
      text,
      time: m.time,
    });
  }
  return row;
}
