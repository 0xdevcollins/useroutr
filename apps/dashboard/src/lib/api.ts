import {
  getToken,
  refreshAccessToken,
  clearTokens,
  isTokenExpired,
} from "./auth";

/**
 * All HTTP calls hit the versioned surface (`/v1/*`). The env var points
 * at the origin only — we append the prefix here so callers can keep
 * writing `api.get("/auth/me")` and not think about versioning.
 */
const API_ORIGIN = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333"
).replace(/\/$/, "");
const BASE_URL = `${API_ORIGIN}/v1`;

function getApiConnectionErrorMessage() {
  return `Cannot reach the Useroutr API at ${API_ORIGIN}. Start it with \`npm run start:api\` or set NEXT_PUBLIC_API_URL.`;
}

interface RequestOptions {
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
}

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

interface ApiErrorBody {
  error?: { message?: string; code?: string };
  message?: string;
}

function extractErrorMessage(body: ApiErrorBody, fallback: string): string {
  return body?.error?.message ?? body?.message ?? fallback;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  const json = JSON.parse(text);

  // Unwrap the { data: T } envelope from the API's TransformInterceptor
  if (json && typeof json === "object" && "data" in json && !("meta" in json)) {
    return json.data as T;
  }

  return json as T;
}

async function getValidToken(): Promise<string | null> {
  const token = getToken();
  if (!token) return null;

  if (!isTokenExpired(token)) return token;

  // Token expired — refresh
  if (isRefreshing) {
    // Queue this request until refresh completes
    return new Promise((resolve) => {
      refreshQueue.push(resolve);
    });
  }

  isRefreshing = true;
  const newToken = await refreshAccessToken();
  isRefreshing = false;

  // Resolve all queued requests
  refreshQueue.forEach((cb) => cb(newToken));
  refreshQueue = [];

  return newToken;
}

async function request<T>(
  method: string,
  path: string,
  options: RequestOptions & { body?: unknown } = {},
): Promise<T> {
  // Concatenate rather than `new URL(path, BASE_URL)` — the URL constructor's
  // second-arg behaviour treats an absolute `path` ("/auth/login") as a
  // pathname replacement, which would silently strip the "/v1" version
  // prefix from BASE_URL. The string-join approach is unambiguous.
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${BASE_URL}${normalizedPath}`);

  if (options.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const token = typeof window !== "undefined" ? await getValidToken() : null;

  let res: Response;

  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  try {
    res = await fetch(url.toString(), {
      method,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      body: isFormData
        ? (options.body as FormData)
        : options.body
          ? JSON.stringify(options.body)
          : undefined,
    });
  } catch {
    throw new Error(getApiConnectionErrorMessage());
  }

  // The "session expired → refresh → retry" dance only makes sense when we
  // actually sent a token. A 401 from an unauthenticated request — e.g.
  // POST /auth/login with the wrong password, or any public endpoint with
  // bad input — means "credentials rejected," not "session timed out."
  // Treating both the same way silently masks real auth errors ("Invalid
  // email or password") behind the misleading "Session expired" banner and
  // bounces the user back to /login they're already on.
  if (res.status === 401 && token && typeof window !== "undefined") {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      clearTokens();
      window.location.href = "/login";
      throw new Error("Session expired");
    }

    // Retry the original request with new token
    let retryRes: Response;

    try {
      retryRes = await fetch(url.toString(), {
        method,
        headers: {
          ...(isFormData ? {} : { "Content-Type": "application/json" }),
          Authorization: `Bearer ${newToken}`,
          ...options.headers,
        },
        body: isFormData
          ? (options.body as FormData)
          : options.body
            ? JSON.stringify(options.body)
            : undefined,
      });
    } catch {
      throw new Error(getApiConnectionErrorMessage());
    }

    if (retryRes.status === 401) {
      clearTokens();
      window.location.href = "/login";
      throw new Error("Session expired");
    }

    if (!retryRes.ok) {
      const retryErrorBody = await parseResponse<ApiErrorBody>(
        retryRes,
      ).catch(() => ({}) as ApiErrorBody);
      throw new Error(
        extractErrorMessage(
          retryErrorBody,
          `API error: ${retryRes.status} ${retryRes.statusText}`,
        ),
      );
    }

    return parseResponse<T>(retryRes);
  }

  if (!res.ok) {
    const errorBody = await parseResponse<ApiErrorBody>(res).catch(
      () => ({}) as ApiErrorBody,
    );
    throw new Error(
      extractErrorMessage(
        errorBody,
        `API error: ${res.status} ${res.statusText}`,
      ),
    );
  }

  return parseResponse<T>(res);
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>("GET", path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PUT", path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>("DELETE", path, options),
};
