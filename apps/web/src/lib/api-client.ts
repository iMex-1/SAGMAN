// In dev, requests go through Next.js rewrites → Fastify (relative URL = no CORS).
// In production (Cloudflare Pages), the API is on a separate Worker domain.
// Set NEXT_PUBLIC_API_URL to the Worker URL (e.g. https://sagman-api.workers.dev).
const API_BASE = (typeof process !== "undefined"
  ? process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_CF_PAGES_URL
  : undefined) ?? "/api/v1";

type RequestOptions = RequestInit & {
  token?: string;
};

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { token, ...fetchOptions } = options;

  const authToken =
    token ??
    (typeof window !== "undefined"
      ? localStorage.getItem("sagman_token")
      : null);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      headers,
    });
  } catch (networkError) {
    throw new ApiError(
      "NETWORK_ERROR",
      "Cannot reach the server. Make sure the API is reachable.",
      0,
    );
  }

  if (response.status === 401 && typeof window !== "undefined") {
    localStorage.removeItem("sagman_token");
    localStorage.removeItem("sagman_refresh_token");
    deleteCookie("sagman_token");
    // Read the actual server error instead of hardcoding "Session expired"
    let message = "Session expired";
    try {
      const errBody = await response.json();
      message = errBody?.error?.message ?? message;
    } catch {}
    // Portal pages handle 401 themselves (redirect to /portal/login).
    // For admin pages, redirect to /login (middleware.ts also catches missing cookie).
    if (!window.location.pathname.startsWith("/portal")) {
      window.location.href = "/login";
    }
    throw new ApiError("UNAUTHORIZED", message, 401);
  }

  const json = await response.json();

  if (!response.ok) {
    throw new ApiError(
      json.error?.code ?? "UNKNOWN_ERROR",
      json.error?.message ?? "An error occurred",
      response.status,
      json.error?.details,
    );
  }

  return json as T;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { method: "GET", ...opts }),

  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body), ...opts }),

  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body), ...opts }),

  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body), ...opts }),

  delete: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { method: "DELETE", ...opts }),
};
