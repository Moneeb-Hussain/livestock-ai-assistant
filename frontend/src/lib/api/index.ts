export { ApiError, apiFetch } from "@/lib/api/client";
export { sendChatMessage } from "@/lib/api/chat";
export { createCase, listCases } from "@/lib/api/cases";
export { reportOutbreakSignal } from "@/lib/api/outbreaks";
export { searchNearbyVets } from "@/lib/api/vets";
export type {
  CaseSummary,
  ChatAttachment,
  ChatHistoryItem,
  ChatRequest,
  ChatResponse,
  ChatRole,
  MaweshiResponseType,
  NormalizedChatResponse,
  OutbreakReportPayload,
  VetResult,
  VetSearchParams,
} from "@/lib/api/types";
