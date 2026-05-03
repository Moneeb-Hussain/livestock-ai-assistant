export { ApiError, apiFetch } from "@/lib/api/client";
export { sendChatMessage } from "@/lib/api/chat";
export { createCase, listCases } from "@/lib/api/cases";
export {
  fetchOutbreakAlerts,
  inferAnimalTypeFromCaseLabel,
  reportOutbreakSignal,
} from "@/lib/api/outbreaks";
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
  OutbreakAlertRow,
  OutbreakReportPayload,
  OutbreakReportResult,
  VetResult,
  VetSearchParams,
} from "@/lib/api/types";
