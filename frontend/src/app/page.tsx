"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { dashboardPathForRole } from "@/lib/auth";

export default function HomePage() {
  const { isAuthenticated, user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
    } else if (user) {
      router.replace(dashboardPathForRole(user.role));
    }
  }, [isAuthenticated, user, isLoading, router]);

  return null;
}
