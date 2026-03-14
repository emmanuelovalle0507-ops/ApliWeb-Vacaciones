"use client";

import { useQuery } from "@tanstack/react-query";
import RoleGuard from "@/components/layout/RoleGuard";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import api from "@/api/client";
import type { ExpenseReport } from "@/types";

export default function AdminExpensesPage() {
  const reportsQ = useQuery({
    queryKey: ["expenses.admin.reports"],
    queryFn: () => api.expenses.finance.listReports(),
  });

  const summaryQ = useQuery({
    queryKey: ["expenses.admin.summary"],
    queryFn: async () => {
      // temporary fallback while frontend client grows for admin summary/reporting
      const reports = await api.expenses.finance.listReports();
      return {
        total: reports.length,
        submitted: reports.filter((r) => r.status === "SUBMITTED").length,
        approved: reports.filter((r) => r.status === "APPROVED").length,
        rejected: reports.filter((r) => r.status === "REJECTED").length,
      };
    },
  });

  const reports = reportsQ.data ?? [];
  const summary = summaryQ.data ?? { total: 0, submitted: 0, approved: 0, rejected: 0 };

  const columns = [
    { key: "title", header: "Reporte", render: (row: ExpenseReport) => <div><p className="font-semibold text-slate-900">{row.title}</p><p className="text-xs text-slate-500">{row.description || "Sin descripción"}</p></div> },
    { key: "status", header: "Estado" },
    { key: "total", header: "Total", render: (row: ExpenseReport) => <span className="font-medium">${row.total.toFixed(2)} {row.currency}</span> },
    { key: "createdAt", header: "Creado", render: (row: ExpenseReport) => new Date(row.createdAt).toLocaleDateString() },
  ];

  return (
    <RoleGuard allowed={["ADMIN", "HR"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Control global de gastos</h1>
          <p className="text-sm text-slate-600 mt-1">Vista global inicial de viáticos y comprobantes.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardBody><p className="text-sm text-slate-500">Total</p><p className="text-3xl font-semibold text-slate-900">{summary.total}</p></CardBody></Card>
          <Card><CardBody><p className="text-sm text-slate-500">Enviados</p><p className="text-3xl font-semibold text-slate-900">{summary.submitted}</p></CardBody></Card>
          <Card><CardBody><p className="text-sm text-slate-500">Aprobados</p><p className="text-3xl font-semibold text-slate-900">{summary.approved}</p></CardBody></Card>
          <Card><CardBody><p className="text-sm text-slate-500">Rechazados</p><p className="text-3xl font-semibold text-slate-900">{summary.rejected}</p></CardBody></Card>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-900">Reportes de gastos</h2>
          </CardHeader>
          <CardBody>
            <Table columns={columns} data={reports} isLoading={reportsQ.isLoading} emptyMessage="No hay reportes registrados todavía." />
          </CardBody>
        </Card>
      </div>
    </RoleGuard>
  );
}
