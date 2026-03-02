"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { User, UserRole } from "@/types";
import { getSession, setSession, clearSession, dashboardPathForRole } from "@/lib/auth";
import api from "@/api/client";
import { useRouter } from "next/navigation";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginDemo: (role?: UserRole) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DEMO_USERS: Record<UserRole, User> = {
  EMPLOYEE: {
    id: "demo-employee",
    fullName: "Demo Empleado",
    email: "demo.employee@vacaciones.local",
    role: "EMPLOYEE",
    area: { id: "demo-team", name: "Equipo Demo" },
    managerId: "demo-manager",
  },
  MANAGER: {
    id: "demo-manager",
    fullName: "Demo Manager",
    email: "demo.manager@vacaciones.local",
    role: "MANAGER",
    area: { id: "demo-team", name: "Equipo Demo" },
  },
  ADMIN: {
    id: "demo-admin",
    fullName: "Demo Admin",
    email: "demo.admin@vacaciones.local",
    role: "ADMIN",
    area: { id: "demo-org", name: "Organización Demo" },
  },
  HR: {
    id: "demo-hr",
    fullName: "Demo RRHH",
    email: "demo.hr@vacaciones.local",
    role: "HR",
    area: { id: "demo-org", name: "RRHH Demo" },
  },
};

const API_MODE = process.env.NEXT_PUBLIC_API_MODE || "mock";
const REAL_DEMO_CREDENTIALS: Partial<Record<UserRole, { email: string; password: string }>> = {
  ADMIN: { email: "admin@vacaciones.local", password: "Admin123!" },
  MANAGER: { email: "manager@vacaciones.local", password: "Manager123!" },
  EMPLOYEE: { email: "employee@vacaciones.local", password: "Employee123!" },
  HR: { email: "hr@seekop.com", password: "1234" },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const session = getSession();
    if (session) {
      const isDemoToken = session.token.startsWith("demo-token-");
      if (API_MODE === "real" && isDemoToken) {
        clearSession();
      } else {
        setUser(session.user);
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.auth.login(email, password);
      setSession(res.token, res.user);
      setUser(res.user);
      router.push(dashboardPathForRole(res.user.role));
    },
    [router]
  );

  const loginDemo = useCallback(
    async (role: UserRole = "ADMIN") => {
      if (API_MODE === "real") {
        const creds = REAL_DEMO_CREDENTIALS[role];
        if (!creds) {
          throw new Error("No hay credenciales demo configuradas para este rol en modo real.");
        }

        const res = await api.auth.login(creds.email, creds.password);
        setSession(res.token, res.user);
        setUser(res.user);
        router.push(dashboardPathForRole(res.user.role));
        return;
      }

      const demoUser = DEMO_USERS[role] ?? DEMO_USERS.ADMIN;
      const token = `demo-token-${role.toLowerCase()}-${Date.now()}`;
      setSession(token, demoUser);
      setUser(demoUser);
      router.push(dashboardPathForRole(demoUser.role));
    },
    [router]
  );

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        loginDemo,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
