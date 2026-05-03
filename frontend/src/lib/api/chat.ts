import { ApiError } from "@/lib/api/client";
import type { ChatHistoryItem, NormalizedChatResponse } from "@/lib/api/types";
import { appConfig } from "@/lib/config";

type SendChatParams = {
  message: string;
  chatHistory: ChatHistoryItem[];
  imageFile?: File | null;
};

/** POST directly to FastAPI `/api/chat` (see `appConfig.apiBaseUrl`; backend must allow CORS). */
function chatUrl(): string {
  return `${appConfig.apiBaseUrl}/api/chat`;
}

function normalizeChatPayload(raw: Record<string, unknown>): NormalizedChatResponse {
  const rt = raw.responseType;
  if (rt === "false_input") {
    return {
      responseType: "false_input",
      possibleConditions: [],
      chatReply: String(raw.chatReply ?? ""),
      careSteps: [],
      disclaimer:
        "MaweshiAI only provides livestock health guidance. Consult a veterinarian for diagnosis and treatment.",
      reason: typeof raw.reason === "string" ? raw.reason : undefined,
    };
  }
  if (rt === "non_medical") {
    const questions = Array.isArray(raw.questions)
      ? (raw.questions as unknown[]).map(String)
      : [];
    return {
      responseType: "non_medical",
      severity: "follow-up",
      possibleConditions: [],
      chatReply: String(raw.chatReply ?? ""),
      careSteps: [],
      disclaimer:
        typeof raw.safeNote === "string" && raw.safeNote.trim()
          ? raw.safeNote
          : "If the animal is very weak, unable to stand, struggling to breathe, or rapidly worsening, contact a veterinarian urgently.",
      questions,
      safeNote: typeof raw.safeNote === "string" ? raw.safeNote : undefined,
    };
  }
  const treatmentPlan =
    raw.treatmentPlan && typeof raw.treatmentPlan === "object"
      ? (raw.treatmentPlan as Record<string, string[]>)
      : undefined;
  return {
    responseType: "medical",
    severity: String(raw.severity ?? "medium"),
    possibleConditions: Array.isArray(raw.possibleConditions)
      ? (raw.possibleConditions as unknown[]).map(String)
      : [],
    chatReply: String(raw.chatReply ?? ""),
    careSteps: Array.isArray(raw.careSteps)
      ? (raw.careSteps as unknown[]).map(String)
      : [],
    disclaimer: String(
      raw.disclaimer ??
        "This is general guidance only and not a veterinary diagnosis. Please consult a qualified veterinarian.",
    ),
    treatmentPlan,
  };
}

/**
 * POST multipart/form-data to FastAPI `/api/chat`:
 * - `message` (required)
 * - `chat_history` — JSON string of `{ role, content }[]` (user | assistant only)
 * - `image` — optional file
 */
export async function sendChatMessage(
  params: SendChatParams,
): Promise<NormalizedChatResponse> {
  const { message, chatHistory, imageFile } = params;

  const historyForApi = chatHistory
    .filter((h) => h.role === "user" || h.role === "assistant")
    .map((h) => ({ role: h.role, content: h.content }));

  const form = new FormData();
  form.set("message", message);
  form.set("chat_history", JSON.stringify(historyForApi));

  if (imageFile && imageFile.size > 0) {
    form.set("image", imageFile, imageFile.name);
  }

  const res = await fetch(chatUrl(), {
    method: "POST",
    body: form,
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  const body = json as Record<string, unknown>;

  if (!res.ok) {
    let msg =
      typeof body.message === "string"
        ? body.message
        : typeof body.detail === "string"
          ? body.detail
          : res.statusText || "Request failed";
    const details = body.details;
    if (details && typeof details === "object" && details !== null) {
      const et = (details as Record<string, unknown>).error_type;
      if (typeof et === "string" && et.length > 0) {
        msg = `${msg} (${et})`;
      }
    }
    throw new ApiError(msg, res.status, body);
  }

  if (!body || body.success !== true || body.data == null) {
    const msg =
      typeof body.message === "string" ? body.message : "Unexpected response from chat API";
    throw new ApiError(msg, res.status, body);
  }

  const data = body.data;
  if (typeof data !== "object" || data === null) {
    throw new ApiError("Chat API returned empty data.", res.status, body);
  }

  return normalizeChatPayload(data as Record<string, unknown>);
}
