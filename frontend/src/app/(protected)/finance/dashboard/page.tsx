"use client";

import { useQuery } from "@tanstack/react-query";
import RoleGuard from "@/components/layout/RoleGuard";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import { ExpenseStatusBadge } from "@/components/ui/Badge";
import api from "@/api/client";
import type { ExpenseReport } from "@/types";

function money(value: number, currency: string) {
  return `${value.toFixed(2)} ${currency}`;
}

export default function FinanceDashboardPage() {
  const reportsQ = useQuery({
    queryKey: ["expenses.finance.dashboard.reports"],
    queryFn: () => api.expenses.finance.listReports(),
  });

  const reports = reportsQ.data ?? [];
  const pending = reports.filter((r) => r.status === "SUBMITTED").length;
  const inReview = reports.filter((r) => r.status === "IN_REVIEW").length;
  const approved = reports.filter((r) => r.status === "APPROVED").length;

  const columns = [
    { key: "title", header: "Reporte", render: (row: ExpenseReport) => <div><p className="font-semibold text-slate-900">{row.title}</p><p className="text-xs text-slate-500">{row.description || "Sin descripción"}</p></div> },
    { key: "status", header: "Estado", render: (row: ExpenseReport) => <ExpenseStatusBadge status={row.status} /> },
    { key: "total", header: "Total", render: (row: ExpenseReport) => <span className="font-medium">{money(row.total, row.currency)}</span> },
    { key: "createdAt", header: "Creado", render: (row: ExpenseReport) => new Date(row.createdAt).toLocaleDateString() },
  ];

  return (
    <RoleGuard allowed={["FINANCE", "ADMIN"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Panel de Finanzas</h1>
          <p className="text-sm text-slate-600 mt-1">
            Vista rápida del flujo financiero de viáticos, reportes y aprobaciones.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardBody><p className="text-sm font-medium text-slate-500">Pendientes</p><p className="text-3xl font-semibold text-slate-900">{pending}</p></CardBody></Card>
          <Card><CardBody><p className="text-sm font-medium text-slate-500">En revisión</p><p className="text-3xl font-semibold text-slate-900">{inReview}</p></CardBody></Card>
          <Card><CardBody><p className="text-sm font-medium text-slate-500">Aprobados</p><p className="text-3xl font-semibold text-slate-900">{approved}</p></CardBody></Card>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-900">Últimos reportes</h2>
          </CardHeader>
          <CardBody>
            <Table columns={columns} data={reports.slice(0, 8)} isLoading={reportsQ.isLoading} emptyMessage="No hay reportes recientes para Finanzas." />
          </CardBody>
        </Card>
      </div>
    </RoleGuard>
  );
}
