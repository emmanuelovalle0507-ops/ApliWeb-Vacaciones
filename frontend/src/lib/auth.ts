import type { User } from "@/types";

const TOKEN_KEY = "vc_token";
const USER_KEY = "vc_user";

/** Decode JWT payload without a library (browser-safe). */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/** Check if a JWT token is expired (with 60s grace margin). */
function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return true;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp < nowSeconds - 60;
}

export function getSession(): { token: string; user: User } | null {
  if (typeof window === "undefined") return null;
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const userStr = localStorage.getItem(USER_KEY);
    if (!token || !userStr) return null;
    if (isTokenExpired(token)) {
      clearSession();
      return null;
    }
    return { token, user: JSON.parse(userStr) as User };
  } catch {
    return null;
  }
}

export function setSession(token: string, user: User): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return getSession() !== null;
}

/** Dashboard path for a given role */
export function dashboardPathForRole(role: User["role"]): string {
  const map: Record<User["role"], string> = {
    EMPLOYEE: "/employee/dashboard",
    MANAGER: "/manager/dashboard",
    ADMIN: "/admin/dashboard",
    HR: "/hr/dashboard",
    FINANCE: "/finance/dashboard",
  };
  return map[role] ?? "/employee/dashboard";
}
