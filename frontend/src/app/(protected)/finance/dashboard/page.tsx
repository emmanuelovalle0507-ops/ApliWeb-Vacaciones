"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import RoleGuard from "@/components/layout/RoleGuard";
import {
  Receipt, CheckCircle, XCircle, AlertTriangle, Loader2,
  FileText, Download, Sparkles, Clock, Eye, X,
  DollarSign, Users, Search, TrendingUp, Building2, Filter,
  PenLine, BarChart3,
} from "lucide-react";
import api from "@/api/client";
import type { ExpenseReceipt, ExpenseReport } from "@/api/real/client";
import { useToast } from "@/components/ui/Toast";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

function getAuthFileUrl(fileUrl: string): string {
  if (!fileUrl || fileUrl === "manual") return "";
  const token = typeof window !== "undefined" ? localStorage.getItem("vc_token") : null;
  const base = `${API_BASE}${fileUrl}`;
  return token ? `${base}${base.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}` : base;
}

const STATUS_MAP: Record<string, { label: string; color: string; border: string }> = {
  DRAFT: { label: "Borrador", color: "bg-gray-100 text-gray-700", border: "border-gray-200" },
  SUBMITTED: { label: "Pendiente", color: "bg-blue-50 text-blue-700", border: "border-blue-200" },
  APPROVED: { label: "Aprobado", color: "bg-emerald-50 text-emerald-700", border: "border-emerald-200" },
  REJECTED: { label: "Rechazado", color: "bg-red-50 text-red-700", border: "border-red-200" },
  NEEDS_CHANGES: { label: "Requiere cambios", color: "bg-amber-50 text-amber-700", border: "border-amber-200" },
};

const CATEGORY_LABELS: Record<string, string> = {
  GASOLINE: "Gasolina", TOLLS: "Casetas", FOOD: "Comida", HOTEL: "Hotel",
  TRANSPORT: "Transporte", PARKING: "Estacionamiento", SUPPLIES: "Insumos", OTHER: "Otro",
};

const EXTRACTION_BADGE: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING: { label: "Pendiente", color: "bg-gray-100 text-gray-600", icon: <Clock size={11} /> },
  PROCESSING: { label: "Procesando", color: "bg-seekop-100 text-seekop-800", icon: <Loader2 size={11} className="animate-spin" /> },
  DONE: { label: "OK", color: "bg-emerald-100 text-emerald-700", icon: <Sparkles size={11} /> },
  FAILED: { label: "Error", color: "bg-red-100 text-red-700", icon: <XCircle size={11} /> },
};

/* ================================================================
   MAIN PAGE
   ================================================================ */
export default function FinanceDashboardPage() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [previewReceipt, setPreviewReceipt] = useState<ExpenseReceipt | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const { data: analyticsData } = useQuery({
    queryKey: ["finance-analytics"],
    queryFn: () => api.finance.getAnalytics(),
    refetchInterval: 30000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["finance-reports", statusFilter, searchQuery],
    queryFn: () => api.finance.listReports({
      status: statusFilter || undefined,
      search: searchQuery || undefined,
      pageSize: 200,
    }),
    refetchInterval: 10000,
  });

  const reports = data?.items ?? [];
  const analytics = analyticsData ?? null;
  const submitted = analytics?.byStatus?.SUBMITTED ?? 0;
  const approved = analytics?.byStatus?.APPROVED ?? 0;
  const rejected = analytics?.byStatus?.REJECTED ?? 0;
  const needsChanges = analytics?.byStatus?.NEEDS_CHANGES ?? 0;

  return (
    <RoleGuard allowed={["FINANCE"]}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Revisión de Gastos</h1>
            <p className="text-sm text-gray-500 mt-1">Revisa, aprueba o rechaza reportes de gastos de los gerentes</p>
          </div>
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showAnalytics ? "bg-seekop-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            <BarChart3 size={14} /> {showAnalytics ? "Ocultar análisis" : "Ver análisis"}
          </button>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: "Pendientes", value: submitted, icon: <Clock size={18} className="text-blue-600" />, bg: "bg-blue-50", highlight: submitted > 0 },
            { label: "Aprobados", value: approved, icon: <CheckCircle size={18} className="text-emerald-600" />, bg: "bg-emerald-50" },
            { label: "Rechazados", value: rejected, icon: <XCircle size={18} className="text-red-600" />, bg: "bg-red-50" },
            { label: "Req. cambios", value: needsChanges, icon: <AlertTriangle size={18} className="text-amber-600" />, bg: "bg-amber-50", highlight: needsChanges > 0 },
            { label: "Monto global", value: `$${(analytics?.totalAmount ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, icon: <DollarSign size={18} className="text-seekop-600" />, bg: "bg-seekop-50" },
          ].map((k, i) => (
            <div key={i} className={`bg-white rounded-xl border p-3.5 flex items-center gap-3 shadow-sm ${k.highlight ? "border-seekop-300 ring-1 ring-seekop-100" : "border-gray-200"}`}>
              <div className={`w-10 h-10 rounded-lg ${k.bg} flex items-center justify-center shrink-0`}>{k.icon}</div>
              <div><p className="text-xl font-bold text-gray-800">{k.value}</p><p className="text-[11px] text-gray-500">{k.label}</p></div>
            </div>
          ))}
        </div>

        {/* Analytics panel (collapsible) */}
        {showAnalytics && analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.keys(analytics.byCategory).length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5"><TrendingUp size={14} /> Gasto por categoría</h3>
                <div className="space-y-2">
                  {Object.entries(analytics.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
                    const max = Math.max(...Object.values(analytics.byCategory));
                    return (
                      <div key={cat} className="flex items-center gap-3">
                        <span className="text-xs text-gray-600 w-28 shrink-0">{CATEGORY_LABELS[cat] ?? cat}</span>
                        <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-seekop-500 rounded-full transition-all" style={{ width: `${(amt / max) * 100}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-gray-700 w-20 text-right">${amt.toLocaleString("es-MX", { minimumFractionDigits: 0 })}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {analytics.topVendors.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Building2 size={14} /> Top proveedores</h3>
                <div className="space-y-2">
                  {analytics.topVendors.slice(0, 8).map((v, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-seekop-100 text-seekop-700 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                        <span className="text-xs text-gray-700 font-medium">{v.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-gray-400">{v.count} tickets</span>
                        <span className="text-xs font-semibold text-gray-700">${v.total.toLocaleString("es-MX", { minimumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* AI Insights summary card */}
            <div className="bg-gradient-to-br from-seekop-50 to-white rounded-xl border border-seekop-200 shadow-sm p-4 md:col-span-2">
              <h3 className="text-xs font-semibold text-seekop-700 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Sparkles size={14} /> Resumen IA</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="bg-white/70 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-gray-800">{analytics.totalReceipts}</p>
                  <p className="text-[10px] text-gray-500">Tickets procesados</p>
                </div>
                <div className="bg-white/70 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-gray-800">${analytics.totalTax.toLocaleString("es-MX", { minimumFractionDigits: 0 })}</p>
                  <p className="text-[10px] text-gray-500">Total impuestos</p>
                </div>
                <div className="bg-white/70 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-gray-800">{Object.keys(analytics.byCategory).length}</p>
                  <p className="text-[10px] text-gray-500">Categorías activas</p>
                </div>
                <div className="bg-white/70 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-gray-800">{analytics.topVendors.length}</p>
                  <p className="text-[10px] text-gray-500">Proveedores únicos</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filter pills + search */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            {["", "SUBMITTED", "APPROVED", "REJECTED", "NEEDS_CHANGES"].map((s) => {
              const active = statusFilter === s;
              return (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setSelectedReport(null); }}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${active ? "bg-seekop-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  {s ? (STATUS_MAP[s]?.label ?? s) : "Todos"}
                  {s === "SUBMITTED" && submitted > 0 && (
                    <span className={`ml-1 px-1 py-0.5 rounded-full text-[10px] ${active ? "bg-white/20" : "bg-blue-100 text-blue-700"}`}>{submitted}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSelectedReport(null); }}
              placeholder="Buscar por título..."
              className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-seekop-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Content: master-detail */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Report list */}
          <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">
                Reportes <span className="text-xs font-normal text-gray-400">({reports.length})</span>
              </h3>
            </div>
            {isLoading ? (
              <div className="p-10 text-center flex-1"><Loader2 className="animate-spin mx-auto text-gray-300" size={28} /></div>
            ) : reports.length === 0 ? (
              <div className="p-10 text-center text-gray-400 flex-1">
                <Receipt size={36} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No hay reportes con este filtro.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[65vh] overflow-y-auto flex-1">
                {reports.map((r) => {
                  const st = STATUS_MAP[r.status] ?? STATUS_MAP.DRAFT;
                  const isActive = selectedReport === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelectedReport(r.id)}
                      className={`w-full text-left px-4 py-3 transition-colors ${isActive ? "bg-seekop-50 border-l-[3px] border-seekop-500" : "hover:bg-gray-50 border-l-[3px] border-transparent"}`}
                    >
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium truncate flex-1 ${isActive ? "text-seekop-800" : "text-gray-800"}`}>{r.title}</p>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 border ${st.color} ${st.border}`}>{st.label}</span>
                      </div>
                      <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                        <span className="flex items-center gap-1"><Users size={11} /> {r.ownerName ?? "—"}</span>
                        {r.totalAmount != null && <span className="font-semibold text-gray-700">${r.totalAmount.toFixed(2)}</span>}
                        <span>{r.receiptCount ?? r.receipts?.length ?? 0} tickets</span>
                      </div>
                      {r.decisionComment && <p className="text-[11px] text-amber-600 mt-0.5 truncate">💬 {r.decisionComment}</p>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-2">
            {selectedReport ? (
              <ReportDetail reportId={selectedReport} onViewReceipt={setPreviewReceipt} />
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-16 text-center">
                <Eye size={40} className="mx-auto mb-3 text-gray-200" />
                <p className="text-sm text-gray-400">Selecciona un reporte de la lista para ver sus detalles</p>
                <p className="text-xs text-gray-300 mt-1">Incluye tickets, montos e historial de decisiones</p>
              </div>
            )}
          </div>
        </div>

        {previewReceipt && <ReceiptPreviewModal receipt={previewReceipt} onClose={() => setPreviewReceipt(null)} />}
      </div>
    </RoleGuard>
  );
}

/* ================================================================
   REPORT DETAIL — tickets table, actions, export
   ================================================================ */
function ReportDetail({ reportId, onViewReceipt }: { reportId: string; onViewReceipt: (r: ExpenseReceipt) => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [comment, setComment] = useState("");
  const [showActions, setShowActions] = useState(false);

  const { data: report, isLoading } = useQuery({
    queryKey: ["finance-report", reportId],
    queryFn: () => api.finance.getReport(reportId),
  });

  const mutOpts = (msg: string) => ({
    onSuccess: () => { toast("success", msg); invalidate(); },
    onError: (err: unknown) => { toast("error", err instanceof Error ? err.message : "Error"); },
  });

  const approveMut = useMutation({ mutationFn: () => api.finance.approve(reportId, comment), ...mutOpts("Reporte aprobado.") });
  const rejectMut = useMutation({ mutationFn: () => api.finance.reject(reportId, comment), ...mutOpts("Reporte rechazado.") });
  const needsChangesMut = useMutation({ mutationFn: () => api.finance.needsChanges(reportId, comment), ...mutOpts("Correcciones solicitadas.") });

  const invalidate = () => {
    setComment("");
    setShowActions(false);
    queryClient.invalidateQueries({ queryKey: ["finance-report", reportId] });
    queryClient.invalidateQueries({ queryKey: ["finance-reports"] });
    queryClient.invalidateQueries({ queryKey: ["finance-analytics"] });
  };

  const acting = approveMut.isPending || rejectMut.isPending || needsChangesMut.isPending;

  if (isLoading || !report) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
        <Loader2 className="animate-spin mx-auto text-gray-300" size={28} />
      </div>
    );
  }

  const st = STATUS_MAP[report.status] ?? STATUS_MAP.DRAFT;
  const receipts = report.receipts ?? [];
  const totalSum = receipts.reduce((s, r) => s + (r.totalAmount ?? 0), 0);
  const taxSum = receipts.reduce((s, r) => s + (r.taxAmount ?? 0), 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-gray-900">{report.title}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${st.color} ${st.border}`}>{st.label}</span>
            </div>
            <div className="flex gap-4 text-xs text-gray-500 mt-1.5 flex-wrap">
              <span>Gerente: <strong className="text-gray-700">{report.ownerName ?? "—"}</strong></span>
              <span>Equipo: <strong className="text-gray-700">{report.teamName ?? "—"}</strong></span>
              <span>Periodo: <strong className="text-gray-700">{report.periodStart} — {report.periodEnd}</strong></span>
            </div>
          </div>
          <a
            href={api.finance.exportReportUrl(reportId)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-seekop-600 text-white rounded-lg text-xs font-medium hover:bg-seekop-700 transition-colors shrink-0 shadow-sm"
          >
            <Download size={14} /> Exportar CSV
          </a>
        </div>

        {/* Summary bar */}
        <div className="flex items-center gap-6 mt-3 pt-3 border-t border-gray-100 text-xs">
          <div>
            <span className="text-gray-400">Tickets:</span>{" "}
            <span className="font-semibold text-gray-700">{receipts.length}</span>
          </div>
          <div>
            <span className="text-gray-400">Subtotal:</span>{" "}
            <span className="font-semibold text-gray-700">${(totalSum - taxSum).toFixed(2)}</span>
          </div>
          <div>
            <span className="text-gray-400">Impuestos:</span>{" "}
            <span className="font-semibold text-gray-700">${taxSum.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-gray-400">Total:</span>{" "}
            <span className="font-bold text-seekop-700 text-sm">${totalSum.toFixed(2)} {report.currency}</span>
          </div>
        </div>
      </div>

      {/* Tickets table */}
      <div className="border-b border-gray-100">
        {receipts.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">Sin tickets adjuntos.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100 bg-gray-50/50">
                  <th className="py-2.5 pl-5 pr-2 font-medium w-10"></th>
                  <th className="py-2.5 pr-3 font-medium">Proveedor</th>
                  <th className="py-2.5 pr-3 font-medium">Fecha</th>
                  <th className="py-2.5 pr-3 font-medium">Categoría</th>
                  <th className="py-2.5 pr-3 font-medium">Método</th>
                  <th className="py-2.5 pr-3 font-medium text-right">Monto</th>
                  <th className="py-2.5 pr-3 font-medium text-right">Impuesto</th>
                  <th className="py-2.5 pr-5 font-medium text-center">IA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {receipts.map((r) => {
                  const ext = EXTRACTION_BADGE[r.extractionStatus] ?? EXTRACTION_BADGE.PENDING;
                  const isManual = r.fileContentType === "application/manual";
                  return (
                    <tr
                      key={r.id}
                      onClick={() => onViewReceipt(r)}
                      className="hover:bg-seekop-50/30 cursor-pointer transition-colors"
                    >
                      <td className="py-2 pl-5 pr-2">
                        <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center overflow-hidden ring-1 ring-gray-200">
                          {isManual ? (
                            <PenLine size={13} className="text-emerald-500" />
                          ) : r.fileContentType.startsWith("image/") ? (
                            <img src={getAuthFileUrl(r.fileUrl)} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          ) : (
                            <FileText size={13} className="text-gray-400" />
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-3 font-medium text-gray-700">{r.vendorName || r.fileName}{isManual && <span className="ml-1 text-[9px] text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded">Manual</span>}</td>
                      <td className="py-2 pr-3 text-gray-500">{r.receiptDate || "—"}</td>
                      <td className="py-2 pr-3 text-gray-500">{r.category ? (CATEGORY_LABELS[r.category] ?? r.category) : "—"}</td>
                      <td className="py-2 pr-3 text-gray-500">{r.paymentMethod || "—"}</td>
                      <td className="py-2 pr-3 text-right font-semibold text-gray-700">
                        {r.totalAmount != null ? `$${r.totalAmount.toFixed(2)}` : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-500">
                        {r.taxAmount != null ? `$${r.taxAmount.toFixed(2)}` : "—"}
                      </td>
                      <td className="py-2 pr-5 text-center">
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${ext.color}`}>
                          {ext.icon}
                          {r.extractionConfidence != null && ` ${(r.extractionConfidence * 100).toFixed(0)}%`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Previous decision comment */}
      {report.decisionComment && (
        <div className="px-5 py-3 border-b border-gray-100 bg-amber-50/60">
          <p className="text-xs text-amber-700">
            <strong>Comentario anterior:</strong> {report.decisionComment}
          </p>
        </div>
      )}

      {/* Actions (only for SUBMITTED reports) */}
      {report.status === "SUBMITTED" && (
        <div className="px-5 py-4">
          {!showActions ? (
            <button
              onClick={() => setShowActions(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-seekop-600 text-white rounded-lg text-sm font-medium hover:bg-seekop-700 transition-colors shadow-sm"
            >
              Tomar acción sobre este reporte
            </button>
          ) : (
            <div className="space-y-3 bg-gray-50 -mx-5 -mb-4 px-5 py-4 rounded-b-xl border-t border-gray-100">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Comentario para el gerente (opcional)</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  placeholder="Ej: Falta comprobante de casetas del día 10..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-seekop-500 focus:border-transparent resize-none bg-white"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => approveMut.mutate()}
                  disabled={acting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {approveMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Aprobar
                </button>
                <button
                  onClick={() => needsChangesMut.mutate()}
                  disabled={acting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {needsChangesMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
                  Pedir correcciones
                </button>
                <button
                  onClick={() => rejectMut.mutate()}
                  disabled={acting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {rejectMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                  Rechazar
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => { setShowActions(false); setComment(""); }}
                  className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   RECEIPT PREVIEW MODAL — view ticket image/PDF
   ================================================================ */
function ReceiptPreviewModal({ receipt, onClose }: { receipt: ExpenseReceipt; onClose: () => void }) {
  const isImage = receipt.fileContentType.startsWith("image/");
  const confidence = receipt.extractionConfidence;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{receipt.vendorName || receipt.fileName}</h2>
            <div className="flex items-center gap-3 mt-0.5 text-xs">
              {receipt.totalAmount != null && (
                <span className="font-semibold text-gray-700">${receipt.totalAmount.toFixed(2)} {receipt.currency}</span>
              )}
              {receipt.category && <span className="text-gray-500">{CATEGORY_LABELS[receipt.category]}</span>}
              {receipt.receiptDate && <span className="text-gray-500">{receipt.receiptDate}</span>}
              {confidence != null && (
                <span className={`font-medium ${confidence >= 0.8 ? "text-emerald-600" : confidence >= 0.5 ? "text-amber-600" : "text-red-500"}`}>
                  IA: {(confidence * 100).toFixed(0)}%
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 flex items-center justify-center min-h-[400px]">
          {isImage ? (
            <img
              src={getAuthFileUrl(receipt.fileUrl)}
              alt="Ticket"
              className="max-w-full max-h-[70vh] rounded-lg shadow-md object-contain"
            />
          ) : (
            <div className="text-center">
              <FileText size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-500 mb-3">Vista previa no disponible para PDF</p>
              <a
                href={getAuthFileUrl(receipt.fileUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-seekop-600 text-white rounded-lg text-sm font-medium hover:bg-seekop-700 transition-colors"
              >
                <Eye size={14} /> Abrir PDF en nueva pestaña
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
