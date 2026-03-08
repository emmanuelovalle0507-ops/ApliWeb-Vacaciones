"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@/types";
import { getSession, setSession, clearSession, dashboardPathForRole } from "@/lib/auth";
import api from "@/api/client";
import { useRouter } from "next/navigation";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    const session = getSession();
    if (session) {
      setUser(session.user);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      queryClient.clear();
      const res = await api.auth.login(email, password);
      setSession(res.token, res.user);
      setUser(res.user);
      if (res.mustChangePassword) {
        router.push("/change-password");
      } else {
        router.push(dashboardPathForRole(res.user.role));
      }
    },
    [router, queryClient]
  );

  const logout = useCallback(() => {
    queryClient.clear();
    clearSession();
    setUser(null);
    router.push("/login");
  }, [router, queryClient]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
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
