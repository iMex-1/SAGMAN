import { jwtVerify } from "jose";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "overseer" | "manager" | "mechanic";
}

export interface ClientUser {
  id: string;
  name: string;
  phone: string;
  type: "client";
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────
// We store the token in BOTH localStorage (for API calls) AND a cookie
// (so the Edge middleware can read it for route protection).

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  document.cookie = `${name}=${value}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

// ─── Auth storage ─────────────────────────────────────────────────────────────

export const authStorage = {
  setTokens(accessToken: string, refreshToken?: string) {
    localStorage.setItem("sagman_token", accessToken);
    if (refreshToken) {
      localStorage.setItem("sagman_refresh_token", refreshToken);
    }
    // Also set a cookie so the Edge middleware can read it (8 hours)
    setCookie("sagman_token", accessToken, 8 * 60 * 60);
  },

  getAccessToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("sagman_token");
  },

  getRefreshToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("sagman_refresh_token");
  },

  clear() {
    localStorage.removeItem("sagman_token");
    localStorage.removeItem("sagman_refresh_token");
    localStorage.removeItem("sagman_user");
    deleteCookie("sagman_token");
  },

  setUser(user: AuthUser | ClientUser) {
    localStorage.setItem("sagman_user", JSON.stringify(user));
  },

  getUser(): AuthUser | ClientUser | null {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem("sagman_user");
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  },
};

// ─── JWT helpers ──────────────────────────────────────────────────────────────

export function decodeJwtPayload(
  token: string,
): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[1]) return null;
    const payload = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export async function verifyJwt(
  token: string,
  secret: string,
): Promise<Record<string, unknown> | null> {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey);
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return true;
  return Date.now() >= payload.exp * 1000;
}
