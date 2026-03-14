"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import RoleGuard from "@/components/layout/RoleGuard";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Table from "@/components/ui/Table";
import Input from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import api from "@/api/client";
import type { ExpenseReport } from "@/types";

export default function FinanceExpensesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string>("");
  const [comment, setComment] = useState("");

  const reportsQ = useQuery({
    queryKey: ["expenses.finance.reports"],
    queryFn: () => api.expenses.finance.listReports(),
  });

  const actionMut = useMutation({
    mutationFn: async (action: "approve" | "reject" | "correction") => {
      if (!selectedId) throw new Error("Selecciona un reporte.");
      if (action === "approve") return api.expenses.finance.approve(selectedId, comment);
      if (action === "reject") return api.expenses.finance.reject(selectedId, comment);
      return api.expenses.finance.requestCorrection(selectedId, comment);
    },
    onSuccess: () => {
      setComment("");
      qc.invalidateQueries({ queryKey: ["expenses.finance.reports"] });
      toast("success", "Acción aplicada correctamente.");
    },
    onError: (err) => toast("error", err instanceof Error ? err.message : "No se pudo aplicar la acción"),
  });

  const reports = reportsQ.data ?? [];

  const columns = [
    { key: "title", header: "Reporte", render: (row: ExpenseReport) => <div><p className="font-semibold text-slate-900">{row.title}</p><p className="text-xs text-slate-500">{row.description || "Sin descripción"}</p></div> },
    { key: "status", header: "Estado" },
    { key: "total", header: "Total", render: (row: ExpenseReport) => <span className="font-medium">${row.total.toFixed(2)} {row.currency}</span> },
    { key: "createdAt", header: "Creado", render: (row: ExpenseReport) => new Date(row.createdAt).toLocaleDateString() },
  ];

  return (
    <RoleGuard allowed={["FINANCE", "ADMIN"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Revisión financiera de viáticos</h1>
          <p className="text-sm text-slate-600 mt-1">Bandeja inicial para aprobar, rechazar o pedir corrección.</p>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-900">Acción rápida</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <select className="w-full px-4 py-2.5 border rounded-lg text-sm border-gray-300" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              <option value="">Selecciona un reporte</option>
              {reports.map((report) => (
                <option key={report.id} value={report.id}>{report.title} — {report.status}</option>
              ))}
            </select>
            <Input label="Comentario" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comentario para Finanzas" />
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => actionMut.mutate("approve")} loading={actionMut.isPending} disabled={!selectedId}>Aprobar</Button>
              <Button variant="danger" onClick={() => actionMut.mutate("reject")} loading={actionMut.isPending} disabled={!selectedId}>Rechazar</Button>
              <Button variant="secondary" onClick={() => actionMut.mutate("correction")} loading={actionMut.isPending} disabled={!selectedId}>Pedir corrección</Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-900">Bandeja de reportes</h2>
          </CardHeader>
          <CardBody>
            <Table columns={columns} data={reports} isLoading={reportsQ.isLoading} emptyMessage="No hay reportes pendientes para Finanzas." />
          </CardBody>
        </Card>
      </div>
    </RoleGuard>
  );
}
