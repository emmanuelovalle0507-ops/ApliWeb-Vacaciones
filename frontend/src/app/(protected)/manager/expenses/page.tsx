"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import RoleGuard from "@/components/layout/RoleGuard";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Table from "@/components/ui/Table";
import { ExpenseStatusBadge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import api from "@/api/client";
import { useAuth } from "@/providers/AuthProvider";
import type { ExpenseReceipt, ExpenseReport } from "@/types";

function money(value: number, currency: string) {
  return `${value.toFixed(2)} ${currency}`;
}

export default function ManagerExpensesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedReportId, setSelectedReportId] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string>("");

  const reportsQ = useQuery({
    queryKey: ["expenses.manager.reports", user?.id],
    queryFn: () => api.expenses.manager.listReports(),
    enabled: !!user,
  });

  useEffect(() => {
    if (!selectedReportId && reportsQ.data?.[0]?.id) setSelectedReportId(reportsQ.data[0].id);
  }, [reportsQ.data, selectedReportId]);

  const detailQ = useQuery({
    queryKey: ["expenses.manager.report", selectedReportId],
    queryFn: () => api.expenses.manager.getReport(selectedReportId),
    enabled: !!selectedReportId,
  });

  const createMut = useMutation({
    mutationFn: () => api.expenses.manager.createReport({ title, description }),
    onSuccess: (report) => {
      setTitle("");
      setDescription("");
      setSelectedReportId(report.id);
      qc.invalidateQueries({ queryKey: ["expenses.manager.reports"] });
      toast("success", "Reporte de viáticos creado.");
    },
    onError: (err) => toast("error", err instanceof Error ? err.message : "No se pudo crear el reporte"),
  });

  const uploadMut = useMutation({
    mutationFn: async () => {
      if (!selectedReportId || !selectedFile) throw new Error("Selecciona reporte y archivo.");
      return api.expenses.manager.uploadReceipt(selectedReportId, selectedFile);
    },
    onSuccess: () => {
      setSelectedFile(null);
      qc.invalidateQueries({ queryKey: ["expenses.manager.reports"] });
      qc.invalidateQueries({ queryKey: ["expenses.manager.report", selectedReportId] });
      toast("success", "Comprobante cargado correctamente.");
    },
    onError: (err) => toast("error", err instanceof Error ? err.message : "No se pudo subir el comprobante"),
  });

  const submitMut = useMutation({
    mutationFn: () => api.expenses.manager.submitReport(selectedReportId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses.manager.reports"] });
      qc.invalidateQueries({ queryKey: ["expenses.manager.report", selectedReportId] });
      toast("success", "Reporte enviado a Finanzas.");
    },
    onError: (err) => toast("error", err instanceof Error ? err.message : "No se pudo enviar el reporte"),
  });

  const analyzeMut = useMutation({
    mutationFn: () => api.expenses.manager.analyzeReceipt(selectedReceiptId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses.manager.report", selectedReportId] });
      toast("success", "Comprobante analizado.");
    },
    onError: (err) => toast("error", err instanceof Error ? err.message : "No se pudo analizar el comprobante"),
  });

  const validateMut = useMutation({
    mutationFn: () => api.expenses.manager.updateReceipt(selectedReceiptId, { isValidated: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses.manager.report", selectedReportId] });
      toast("success", "Comprobante validado manualmente.");
    },
    onError: (err) => toast("error", err instanceof Error ? err.message : "No se pudo validar el comprobante"),
  });

  const reports = reportsQ.data ?? [];
  const detail = detailQ.data ?? null;
  const receipts = detail?.receipts ?? [];
  const actions = detail?.actions ?? [];

  useEffect(() => {
    if (!selectedReceiptId && receipts[0]?.id) setSelectedReceiptId(receipts[0].id);
  }, [receipts, selectedReceiptId]);

  const selectedReceipt = useMemo(
    () => receipts.find((item) => item.id === selectedReceiptId) ?? receipts[0] ?? null,
    [receipts, selectedReceiptId]
  );

  const reportColumns = [
    { key: "title", header: "Reporte", render: (row: ExpenseReport) => <div><p className="font-semibold text-slate-900">{row.title}</p><p className="text-xs text-slate-500">{row.description || "Sin descripción"}</p></div> },
    { key: "status", header: "Estado", render: (row: ExpenseReport) => <ExpenseStatusBadge status={row.status} /> },
    { key: "total", header: "Total", render: (row: ExpenseReport) => <span className="font-medium">{money(row.total, row.currency)}</span> },
    { key: "receipts", header: "Comprobantes", render: (row: ExpenseReport) => <span>{row.receipts?.length ?? 0}</span> },
  ];

  const receiptColumns = [
    { key: "originalFilename", header: "Archivo" },
    { key: "ocrStatus", header: "OCR" },
    { key: "issuerName", header: "Proveedor", render: (row: ExpenseReceipt) => row.issuerName || "—" },
    { key: "total", header: "Total", render: (row: ExpenseReceipt) => money(row.total, row.currency) },
    { key: "isValidated", header: "Validado", render: (row: ExpenseReceipt) => (row.isValidated ? "Sí" : "No") },
  ];

  return (
    <RoleGuard allowed={["MANAGER", "ADMIN"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Viáticos y gastos</h1>
          <p className="text-sm text-slate-600 mt-1">Crea reportes, sube comprobantes, revisa extracción y envía a Finanzas.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><h2 className="text-lg font-semibold text-slate-900">Nuevo reporte</h2></CardHeader>
            <CardBody className="space-y-4">
              <Input label="Título" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Viaje a cliente Monterrey" />
              <Input label="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalle general del gasto" />
              <Button onClick={() => createMut.mutate()} loading={createMut.isPending} disabled={!title.trim()}>Crear reporte</Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h2 className="text-lg font-semibold text-slate-900">Subir comprobante</h2></CardHeader>
            <CardBody className="space-y-4">
              <select className="w-full px-4 py-2.5 border rounded-lg text-sm border-gray-300" value={selectedReportId} onChange={(e) => setSelectedReportId(e.target.value)}>
                <option value="">Selecciona un reporte</option>
                {reports.map((report) => <option key={report.id} value={report.id}>{report.title}</option>)}
              </select>
              <input type="file" accept="image/*,.pdf,.xml,text/xml,application/xml" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} />
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => uploadMut.mutate()} loading={uploadMut.isPending} disabled={!selectedReportId || !selectedFile}>Subir comprobante</Button>
                <Button variant="secondary" onClick={() => submitMut.mutate()} loading={submitMut.isPending} disabled={!selectedReportId || !detail || receipts.length === 0}>Enviar a Finanzas</Button>
              </div>
              {detail && (
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
                  <p><span className="font-medium text-slate-800">Estado:</span> {detail.status}</p>
                  <p><span className="font-medium text-slate-800">Total:</span> {money(detail.total, detail.currency)}</p>
                  {detail.financeComment && <p><span className="font-medium text-slate-800">Comentario Finanzas:</span> {detail.financeComment}</p>}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader><h2 className="text-lg font-semibold text-slate-900">Mis reportes</h2></CardHeader>
          <CardBody>
            <Table columns={reportColumns} data={reports} isLoading={reportsQ.isLoading} emptyMessage="Aún no hay reportes de viáticos." />
          </CardBody>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader><h2 className="text-lg font-semibold text-slate-900">Comprobantes del reporte</h2></CardHeader>
            <CardBody className="space-y-4">
              <Table columns={receiptColumns} data={receipts} isLoading={detailQ.isLoading} emptyMessage="Este reporte aún no tiene comprobantes." />
              {receipts.length > 0 && (
                <select className="w-full px-4 py-2.5 border rounded-lg text-sm border-gray-300" value={selectedReceiptId} onChange={(e) => setSelectedReceiptId(e.target.value)}>
                  {receipts.map((receipt) => <option key={receipt.id} value={receipt.id}>{receipt.originalFilename}</option>)}
                </select>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h2 className="text-lg font-semibold text-slate-900">Detalle del comprobante</h2></CardHeader>
            <CardBody className="space-y-4">
              {selectedReceipt ? (
                <>
                  <div className="text-sm space-y-2 text-slate-700">
                    <p><span className="font-medium">Proveedor:</span> {selectedReceipt.issuerName || "—"}</p>
                    <p><span className="font-medium">RFC:</span> {selectedReceipt.issuerRfc || "—"}</p>
                    <p><span className="font-medium">Folio:</span> {selectedReceipt.folio || "—"}</p>
                    <p><span className="font-medium">Fecha:</span> {selectedReceipt.invoiceDate || "—"}</p>
                    <p><span className="font-medium">Subtotal:</span> {money(selectedReceipt.subtotal, selectedReceipt.currency)}</p>
                    <p><span className="font-medium">IVA:</span> {money(selectedReceipt.iva, selectedReceipt.currency)}</p>
                    <p><span className="font-medium">Total:</span> {money(selectedReceipt.total, selectedReceipt.currency)}</p>
                    <p><span className="font-medium">Categoría sugerida:</span> {selectedReceipt.suggestedCategory || "—"}</p>
                    <p><span className="font-medium">Confianza IA:</span> {selectedReceipt.aiConfidence ?? "—"}</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="secondary" onClick={() => analyzeMut.mutate()} loading={analyzeMut.isPending}>Re-analizar</Button>
                    <Button onClick={() => validateMut.mutate()} loading={validateMut.isPending}>Marcar validado</Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">Selecciona un comprobante para ver el detalle.</p>
              )}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader><h2 className="text-lg font-semibold text-slate-900">Timeline del reporte</h2></CardHeader>
          <CardBody>
            <div className="space-y-3 text-sm text-slate-700">
              {actions.length === 0 ? (
                <p className="text-slate-500">Sin actividad todavía.</p>
              ) : actions.map((action) => (
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
