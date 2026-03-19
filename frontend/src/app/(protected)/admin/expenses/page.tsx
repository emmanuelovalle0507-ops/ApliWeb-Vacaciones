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

export default function AdminExpensesPage() {
  const reportsQ = useQuery({
    queryKey: ["expenses.admin.reports"],
    queryFn: () => api.expenses.admin.listReports(),
  });

  const summaryQ = useQuery({
    queryKey: ["expenses.admin.summary"],
    queryFn: () => api.expenses.admin.summary(),
  });

  const reports = reportsQ.data ?? [];
  const summary = summaryQ.data ?? {};

  const columns = [
    { key: "title", header: "Reporte", render: (row: ExpenseReport) => <div><p className="font-semibold text-slate-900">{row.title}</p><p className="text-xs text-slate-500">{row.description || "Sin descripción"}</p></div> },
    { key: "status", header: "Estado", render: (row: ExpenseReport) => <ExpenseStatusBadge status={row.status} /> },
    { key: "total", header: "Total", render: (row: ExpenseReport) => <span className="font-medium">{money(row.total, row.currency)}</span> },
    { key: "createdAt", header: "Creado", render: (row: ExpenseReport) => new Date(row.createdAt).toLocaleDateString() },
  ];

  return (
    <RoleGuard allowed={["ADMIN", "HR"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Control global de gastos</h1>
          <p className="text-sm text-slate-600 mt-1">Vista global de viáticos, comprobantes y estado operativo del flujo.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardBody><p className="text-sm text-slate-500">Borradores</p><p className="text-3xl font-semibold text-slate-900">{summary.DRAFT ?? 0}</p></CardBody></Card>
          <Card><CardBody><p className="text-sm text-slate-500">Enviados</p><p className="text-3xl font-semibold text-slate-900">{summary.SUBMITTED ?? 0}</p></CardBody></Card>
          <Card><CardBody><p className="text-sm text-slate-500">Aprobados</p><p className="text-3xl font-semibold text-slate-900">{summary.APPROVED ?? 0}</p></CardBody></Card>
          <Card><CardBody><p className="text-sm text-slate-500">Rechazados</p><p className="text-3xl font-semibold text-slate-900">{summary.REJECTED ?? 0}</p></CardBody></Card>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-900">Reportes de gastos</h2>
          </CardHeader>
          <CardBody>
            <Table columns={columns} data={reports} isLoading={reportsQ.isLoading || summaryQ.isLoading} emptyMessage="No hay reportes registrados todavía." />
          </CardBody>
        </Card>
      </div>
    </RoleGuard>
  );
}
