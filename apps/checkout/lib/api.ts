const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333/v1";

interface RequestOptions {
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
}

/**
 * Surfaced for callers that need to branch on HTTP status — e.g. the link
 * resolve page distinguishes 404 (no such link) from 410 (link is inactive,
 * expired, or single-use exhausted). Plain `Error` only carries the message;
 * we need the status code too without forcing every caller to dig into the
 * fetch Response.
 *
 * The `code` field is the structured error code from the API's
 * GlobalExceptionFilter envelope (`{ error: { code, message, ... } }`) when
 * present — useful for analytics / Sentry grouping.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  method: string,
  path: string,
  options: RequestOptions & { body?: unknown } = {},
): Promise<T> {
  // Use string concat rather than `new URL(path, BASE_URL)` so an absolute
  // `path` like `/v1/links/abc` doesn't replace BASE_URL's pathname when
  // BASE_URL itself carries a path prefix (e.g. behind an ingress).
  const queryString = options.params
    ? "?" +
      new URLSearchParams(
        Object.fromEntries(
          Object.entries(options.params)
            .filter(([, v]) => v !== undefined && v !== null)
            .map(([k, v]) => [k, String(v)]),
        ),
      ).toString()
    : "";
  const url = `${BASE_URL}${path}${queryString}`;

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    let message = `API error: ${res.status} ${res.statusText}`;
    let code: string | null = null;

    try {
      const data = (await res.json()) as {
        message?: string | string[];
        error?: string | { code?: string; message?: string };
      };

      // GlobalExceptionFilter envelope: { error: { code, message, ... } }
      if (data.error && typeof data.error === "object") {
        if (typeof data.error.message === "string")
          message = data.error.message;
        if (typeof data.error.code === "string") code = data.error.code;
      } else if (Array.isArray(data.message) && data.message.length > 0) {
        message = data.message.join(", ");
      } else if (typeof data.message === "string" && data.message.length > 0) {
        message = data.message;
      } else if (typeof data.error === "string" && data.error.length > 0) {
        message = data.error;
      }
    } catch {
      // Fall back to the default HTTP status text when the response is not JSON.
    }

    throw new ApiError(message, res.status, code);
  }

  const json = await res.json();
  // The API wraps some responses in { data: ... } via TransformInterceptor;
  // public endpoints like /v1/links/:shortCode return the object directly.
  return json.data !== undefined ? json.data : json;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>("GET", path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, { ...options, body }),
};
