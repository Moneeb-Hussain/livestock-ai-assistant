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

type ApiFetchOptions = {
  /** Full request URL (bypasses `appConfig.apiBaseUrl`). Use for same-origin rewrites. */
  absoluteUrl?: string;
};

export async function apiFetch<T>(
  path: string,
  init: JsonInit = {},
  options?: ApiFetchOptions,
): Promise<T> {
  const url = options?.absoluteUrl
    ? options.absoluteUrl
    : `${appConfig.apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
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
    const obj = typeof data === "object" && data ? (data as Record<string, unknown>) : null;
    const msg =
      obj && typeof obj.message === "string"
        ? obj.message
        : obj && "detail" in obj
          ? String(obj.detail)
          : res.statusText || "Request failed";
    throw new ApiError(msg, res.status, data);
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
