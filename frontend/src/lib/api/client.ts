import { appConfig } from "@/lib/config";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type JsonInit = Omit<RequestInit, "body"> & {
  body?: unknown;
};

export async function apiFetch<T>(
  path: string,
  init: JsonInit = {},
): Promise<T> {
  const url = `${appConfig.apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init.headers);

  let body: BodyInit | undefined = init.body as BodyInit | undefined;
  if (init.body !== undefined && typeof init.body === "object") {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    body = JSON.stringify(init.body);
  }

  const res = await fetch(url, { ...init, headers, body });

  const text = await res.text();
  const data = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    throw new ApiError(
      typeof data === "object" && data && "detail" in data
        ? String((data as { detail: unknown }).detail)
        : res.statusText || "Request failed",
      res.status,
      data,
    );
  }

  return data as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
