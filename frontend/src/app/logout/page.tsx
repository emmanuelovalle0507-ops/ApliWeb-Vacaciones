"use client";

import { useEffect } from "react";
import { useAuth } from "@/providers/AuthProvider";

export default function LogoutPage() {
  const { logout } = useAuth();

  useEffect(() => {
    logout();
  }, [logout]);

  return null;
}
