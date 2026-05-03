export type ChatRole = "system" | "user" | "assistant";

export type ChatHistoryItem = {
  role: ChatRole;
  content: string;
};

export type ChatAttachment = {
  id: string;
  mimeType: string;
  name: string;
  url?: string;
};

export type ChatRequest = {
  message: string;
  attachments: ChatAttachment[];
  chatHistory: ChatHistoryItem[];
  caseId?: string;
};

export type MaweshiResponseType = "medical" | "non_medical" | "false_input";

/** Normalized assistant payload for UI (all branches). */
export type NormalizedChatResponse = {
  responseType: MaweshiResponseType;
  severity?: string;
  possibleConditions: string[];
  chatReply: string;
  careSteps: string[];
  disclaimer: string;
  questions?: string[];
  safeNote?: string;
  reason?: string;
  treatmentPlan?: Record<string, string[]>;
};

/** @deprecated Use NormalizedChatResponse */
export type ChatResponse = NormalizedChatResponse;

export type CaseSummary = {
  id: string;
  label: string;
  animalType?: string;
  updatedAt: string;
};

/** Client-side fields; `reportOutbreakSignal` maps to backend snake_case body. */
export type OutbreakReportPayload = {
  /** Local case id (not sent to API; for logging / future use). */
  caseId: string;
  /** Case title, e.g. "Goat — …", used to infer `animal_type` when `animalType` is missing. */
  caseLabel?: string;
  /** Required by backend `animal_type`; infer from case label if omitted. */
  animalType?: string;
  /** Required by backend `symptom_group` as comma-separated keywords. */
  symptomSummary?: string;
  possibleConditions?: string[];
  severity?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  language?: string;
};

/** POST `/api/outbreaks` success shape from FastAPI + `outbreak_service`. */
export type OutbreakReportResult = {
  success: boolean;
  report?: unknown;
  alert_status?: {
    alert_created?: boolean;
    alert_updated?: boolean;
    risk_level?: string;
    case_count?: number;
  };
};

export type VetSearchParams = {
  lat: number;
  lng: number;
  radiusKm?: number;
};

export type VetResult = {
  name: string;
  distanceKm: number;
  address: string;
  mapUrl: string;
};
