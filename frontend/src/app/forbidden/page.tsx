"use client";

import React from "react";
import { ShieldX } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { dashboardPathForRole } from "@/lib/auth";
import Button from "@/components/ui/Button";
import Link from "next/link";

export default function ForbiddenPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-red-50 rounded-full">
            <ShieldX size={48} className="text-red-500" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Acceso Denegado</h1>
        <p className="text-gray-500 mb-6">
          No tienes permisos para acceder a esta página. Contacta a un administrador si crees
          que esto es un error.
        </p>
        {user ? (
          <Link href={dashboardPathForRole(user.role)}>
            <Button>Ir a mi dashboard</Button>
          </Link>
        ) : (
          <Link href="/login">
            <Button>Iniciar sesión</Button>
          </Link>
        )}
      </div>
    </div>
  );
}
