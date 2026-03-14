"use client";

import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import RoleGuard from "@/components/layout/RoleGuard";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Table from "@/components/ui/Table";
import { RoleBadge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import api from "@/api/client";
import { useAuth } from "@/providers/AuthProvider";
import type { ExpenseReport } from "@/types";

export default function ManagerExpensesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedReportId, setSelectedReportId] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const reportsQ = useQuery({
    queryKey: ["expenses.manager.reports", user?.id],
    queryFn: () => api.expenses.manager.listReports(),
    enabled: !!user,
  });

  const createMut = useMutation({
    mutationFn: () => api.expenses.manager.createReport({ title, description }),
    onSuccess: () => {
      setTitle("");
      setDescription("");
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
      toast("success", "Comprobante cargado correctamente.");
    },
    onError: (err) => toast("error", err instanceof Error ? err.message : "No se pudo subir el comprobante"),
  });

  const reports = reportsQ.data ?? [];
  const selectedReport = useMemo(
    () => reports.find((item) => item.id === selectedReportId) ?? reports[0] ?? null,
    [reports, selectedReportId]
  );

  const columns = [
    { key: "title", header: "Reporte", render: (row: ExpenseReport) => <div><p className="font-semibold text-slate-900">{row.title}</p><p className="text-xs text-slate-500">{row.description || "Sin descripción"}</p></div> },
    { key: "status", header: "Estado", render: (row: ExpenseReport) => <RoleBadge role={row.status} /> },
    { key: "total", header: "Total", render: (row: ExpenseReport) => <span className="font-medium">${row.total.toFixed(2)} {row.currency}</span> },
    { key: "receipts", header: "Comprobantes", render: (row: ExpenseReport) => <span>{row.receipts?.length ?? 0}</span> },
  ];

  return (
    <RoleGuard allowed={["MANAGER", "ADMIN"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Viáticos y gastos</h1>
          <p className="text-sm text-slate-600 mt-1">Crea reportes, sube comprobantes y prepara el envío a Finanzas.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-900">Nuevo reporte</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <Input label="Título" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Viaje a cliente Monterrey" />
              <Input label="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalle general del gasto" />
              <Button onClick={() => createMut.mutate()} loading={createMut.isPending} disabled={!title.trim()}>
                Crear reporte
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-900">Subir comprobante</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <select
                className="w-full px-4 py-2.5 border rounded-lg text-sm border-gray-300"
                value={selectedReportId}
                onChange={(e) => setSelectedReportId(e.target.value)}
              >
                <option value="">Selecciona un reporte</option>
                {reports.map((report) => (
                  <option key={report.id} value={report.id}>
                    {report.title}
                  </option>
                ))}
              </select>
              <input type="file" accept="image/*,.pdf,.xml,text/xml,application/xml" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} />
              <Button onClick={() => uploadMut.mutate()} loading={uploadMut.isPending} disabled={!selectedReportId || !selectedFile}>
                Subir comprobante
              </Button>
              {selectedReport && (
                <p className="text-xs text-slate-500">
                  Reporte seleccionado: <span className="font-medium text-slate-700">{selectedReport.title}</span>
                </p>
              )}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-900">Mis reportes</h2>
          </CardHeader>
          <CardBody>
            <Table columns={columns} data={reports} isLoading={reportsQ.isLoading} emptyMessage="Aún no hay reportes de viáticos." />
          </CardBody>
        </Card>
      </div>
    </RoleGuard>
  );
}
