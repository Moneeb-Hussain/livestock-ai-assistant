import { apiFetch } from "@/lib/api/client";
import type { ChatRequest, ChatResponse } from "@/lib/api/types";

export async function sendChatMessage(
  payload: ChatRequest,
): Promise<ChatResponse> {
  return apiFetch<ChatResponse>("/api/chat", {
    method: "POST",
    body: payload,
  });
}
