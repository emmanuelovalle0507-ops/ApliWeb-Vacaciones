"use client";

import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import RoleGuard from "@/components/layout/RoleGuard";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Table from "@/components/ui/Table";
import Input from "@/components/ui/Input";
import { ExpenseStatusBadge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import api from "@/api/client";
import type { ExpenseReceipt, ExpenseReport } from "@/types";

function money(value: number, currency: string) {
  return `${value.toFixed(2)} ${currency}`;
}

export default function FinanceExpensesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string>("");
  const [comment, setComment] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const reportsQ = useQuery({
    queryKey: ["expenses.finance.reports", statusFilter],
    queryFn: () => api.expenses.finance.listReports(statusFilter || undefined),
  });

  useEffect(() => {
    if (!selectedId && reportsQ.data?.[0]?.id) setSelectedId(reportsQ.data[0].id);
  }, [reportsQ.data, selectedId]);

  const detailQ = useQuery({
    queryKey: ["expenses.finance.report", selectedId],
    queryFn: () => api.expenses.finance.getReport(selectedId),
    enabled: !!selectedId,
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
      qc.invalidateQueries({ queryKey: ["expenses.finance.report", selectedId] });
      toast("success", "Acción aplicada correctamente.");
    },
    onError: (err) => toast("error", err instanceof Error ? err.message : "No se pudo aplicar la acción"),
  });

  const reports = reportsQ.data ?? [];
  const detail = detailQ.data ?? null;
  const receipts = detail?.receipts ?? [];

  const columns = [
    { key: "title", header: "Reporte", render: (row: ExpenseReport) => <div><p className="font-semibold text-slate-900">{row.title}</p><p className="text-xs text-slate-500">{row.description || "Sin descripción"}</p></div> },
    { key: "status", header: "Estado", render: (row: ExpenseReport) => <ExpenseStatusBadge status={row.status} /> },
    { key: "total", header: "Total", render: (row: ExpenseReport) => <span className="font-medium">{money(row.total, row.currency)}</span> },
    { key: "createdAt", header: "Creado", render: (row: ExpenseReport) => new Date(row.createdAt).toLocaleDateString() },
  ];

  const receiptColumns = [
    { key: "originalFilename", header: "Archivo" },
    { key: "ocrStatus", header: "OCR" },
    { key: "issuerName", header: "Proveedor", render: (row: ExpenseReceipt) => row.issuerName || "—" },
    { key: "total", header: "Total", render: (row: ExpenseReceipt) => money(row.total, row.currency) },
    { key: "suggestedCategory", header: "Categoría", render: (row: ExpenseReceipt) => row.suggestedCategory || "—" },
  ];

  return (
    <RoleGuard allowed={["FINANCE", "ADMIN"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Revisión financiera de viáticos</h1>
          <p className="text-sm text-slate-600 mt-1">Bandeja operativa para revisar, aprobar, rechazar o pedir corrección.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardBody><p className="text-sm text-slate-500">Reportes</p><p className="text-3xl font-semibold text-slate-900">{reports.length}</p></CardBody></Card>
          <Card><CardBody><p className="text-sm text-slate-500">Pendientes</p><p className="text-3xl font-semibold text-slate-900">{reports.filter((r) => r.status === "SUBMITTED").length}</p></CardBody></Card>
          <Card><CardBody><p className="text-sm text-slate-500">Corrección</p><p className="text-3xl font-semibold text-slate-900">{reports.filter((r) => r.status === "NEEDS_CORRECTION").length}</p></CardBody></Card>
          <Card><CardBody><p className="text-sm text-slate-500">Aprobados</p><p className="text-3xl font-semibold text-slate-900">{reports.filter((r) => r.status === "APPROVED").length}</p></CardBody></Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader><h2 className="text-lg font-semibold text-slate-900">Bandeja de reportes</h2></CardHeader>
            <CardBody className="space-y-4">
              <select className="w-full px-4 py-2.5 border rounded-lg text-sm border-gray-300" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Todos los estados</option>
                <option value="SUBMITTED">SUBMITTED</option>
                <option value="APPROVED">APPROVED</option>
                <option value="REJECTED">REJECTED</option>
                <option value="NEEDS_CORRECTION">NEEDS_CORRECTION</option>
              </select>
              <Table columns={columns} data={reports} isLoading={reportsQ.isLoading} emptyMessage="No hay reportes para Finanzas." />
              {reports.length > 0 && (
                <select className="w-full px-4 py-2.5 border rounded-lg text-sm border-gray-300" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                  {reports.map((report) => <option key={report.id} value={report.id}>{report.title} — {report.status}</option>)}
                </select>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h2 className="text-lg font-semibold text-slate-900">Decisión financiera</h2></CardHeader>
            <CardBody className="space-y-4">
              {detail ? (
                <>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700 space-y-2">
                    <p><span className="font-medium text-slate-800">Reporte:</span> {detail.title}</p>
                    <p><span className="font-medium text-slate-800">Estado:</span> {detail.status}</p>
                    <p><span className="font-medium text-slate-800">Total:</span> {money(detail.total, detail.currency)}</p>
                    <p><span className="font-medium text-slate-800">Comprobantes:</span> {detail.receipts.length}</p>
                  </div>
                  <Input label="Comentario" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comentario para el manager" />
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={() => actionMut.mutate("approve")} loading={actionMut.isPending} disabled={!selectedId}>Aprobar</Button>
                    <Button variant="danger" onClick={() => actionMut.mutate("reject")} loading={actionMut.isPending} disabled={!selectedId}>Rechazar</Button>
                    <Button variant="secondary" onClick={() => actionMut.mutate("correction")} loading={actionMut.isPending} disabled={!selectedId}>Pedir corrección</Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">Selecciona un reporte para revisarlo.</p>
              )}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader><h2 className="text-lg font-semibold text-slate-900">Detalle de comprobantes</h2></CardHeader>
          <CardBody>
            <Table columns={receiptColumns} data={receipts} isLoading={detailQ.isLoading} emptyMessage="Este reporte no tiene comprobantes." />
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h2 className="text-lg font-semibold text-slate-900">Timeline del reporte</h2></CardHeader>
          <CardBody>
            <div className="space-y-3 text-sm text-slate-700">
              {!detail || detail.actions.length === 0 ? (
                <p className="text-slate-500">Sin actividad registrada todavía.</p>
              ) : detail.actions.map((action) => (
                <div key={action.id} className="rounded-xl border border-slate-200 px-4 py-3 bg-slate-50">
                  <p className="font-medium text-slate-800">{action.actionType}</p>
                  {action.comment && <p className="text-slate-600 mt-1">{action.comment}</p>}
                  <p className="text-xs text-slate-500 mt-1">{new Date(action.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </RoleGuard>
  );
}
