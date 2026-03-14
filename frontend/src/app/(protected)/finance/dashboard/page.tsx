"use client";

import RoleGuard from "@/components/layout/RoleGuard";
import Card from "@/components/ui/Card";

export default function FinanceDashboardPage() {
  return (
    <RoleGuard allowed={["FINANCE", "ADMIN"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Panel de Finanzas</h1>
          <p className="text-sm text-slate-600 mt-1">
            Base inicial para revisión de viáticos, comprobantes y flujo de aprobación financiera.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-500">Pendientes</p>
              <p className="text-3xl font-semibold text-slate-900">—</p>
            </div>
          </Card>
          <Card>
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-500">En revisión</p>
              <p className="text-3xl font-semibold text-slate-900">—</p>
            </div>
          </Card>
          <Card>
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-500">Aprobados</p>
              <p className="text-3xl font-semibold text-slate-900">—</p>
            </div>
          </Card>
        </div>

        <Card>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">Estado actual</h2>
            <p className="text-sm text-slate-600">
              Ya quedó preparada la base backend del módulo de viáticos. Lo siguiente es conectar esta vista con la bandeja
              de reportes y revisión de comprobantes.
            </p>
          </div>
        </Card>
      </div>
    </RoleGuard>
  );
}
