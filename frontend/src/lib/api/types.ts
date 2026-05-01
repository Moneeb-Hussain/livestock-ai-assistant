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

export type ChatResponse = {
  severity: "low" | "moderate" | "urgent" | string;
  possibleConditions: string[];
  chatReply: string;
  careSteps: string[];
  disclaimer: string;
};

export type CaseSummary = {
  id: string;
  label: string;
  animalType?: string;
  updatedAt: string;
};

export type OutbreakReportPayload = {
  caseId: string;
  animalType?: string;
  symptomSummary?: string;
  possibleConditions?: string[];
  severity?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
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
