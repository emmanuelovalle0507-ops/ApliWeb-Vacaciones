import type { User } from "@/types";

const TOKEN_KEY = "vc_token";
const USER_KEY = "vc_user";

export function getSession(): { token: string; user: User } | null {
  if (typeof window === "undefined") return null;
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const userStr = localStorage.getItem(USER_KEY);
    if (!token || !userStr) return null;
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
