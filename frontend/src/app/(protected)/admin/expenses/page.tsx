"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import RoleGuard from "@/components/layout/RoleGuard";
import {
  Receipt, FileText, Clock, Loader2, Sparkles, X, XCircle,
  DollarSign, CheckCircle, AlertTriangle, Download, Eye,
  Users, Search, BarChart3, TrendingUp, Building2, Filter,
} from "lucide-react";
import api from "@/api/client";
import type { ExpenseReceipt, ExpenseReport, ExpenseAnalytics } from "@/api/real/client";
import { useToast } from "@/components/ui/Toast";

const API_BASE = "/api/v1";

function getAuthFileUrl(fileUrl: string): string {
  if (!fileUrl || fileUrl === "manual") return "";
  const token = typeof window !== "undefined" ? localStorage.getItem("vc_token") : null;
  return token ? `${fileUrl}${fileUrl.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}` : fileUrl;
}

const STATUS_MAP: Record<string, { label: string; color: string; border: string }> = {
  DRAFT: { label: "Borrador", color: "bg-gray-100 text-gray-700", border: "border-gray-200" },
  SUBMITTED: { label: "Pendiente", color: "bg-blue-50 text-blue-700", border: "border-blue-200" },
  APPROVED: { label: "Aprobado", color: "bg-emerald-50 text-emerald-700", border: "border-emerald-200" },
  REJECTED: { label: "Rechazado", color: "bg-red-50 text-red-700", border: "border-red-200" },
  NEEDS_CHANGES: { label: "Req. cambios", color: "bg-amber-50 text-amber-700", border: "border-amber-200" },
};

const CAT_LABELS: Record<string, string> = {
  GASOLINE: "Gasolina", TOLLS: "Casetas", FOOD: "Comida", HOTEL: "Hotel",
  TRANSPORT: "Transporte", PARKING: "Estacionamiento", SUPPLIES: "Insumos", OTHER: "Otro",
};

const EXT_BADGE: Record<string, { color: string; icon: React.ReactNode }> = {
  PENDING: { color: "bg-gray-100 text-gray-600", icon: <Clock size={11} /> },
  PROCESSING: { color: "bg-seekop-100 text-seekop-800", icon: <Loader2 size={11} className="animate-spin" /> },
  DONE: { color: "bg-emerald-100 text-emerald-700", icon: <Sparkles size={11} /> },
  FAILED: { color: "bg-red-100 text-red-700", icon: <XCircle size={11} /> },
};

export default function AdminExpensesPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewReceipt, setPreviewReceipt] = useState<ExpenseReceipt | null>(null);

  const { data: analyticsData } = useQuery({
    queryKey: ["admin-expense-analytics"],
    queryFn: () => api.finance.getAnalytics(),
    refetchInterval: 30000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-expense-reports", statusFilter, searchQuery],
    queryFn: () => api.finance.listReports({
      status: statusFilter || undefined,
      search: searchQuery || undefined,
      pageSize: 200,
    }),
    refetchInterval: 15000,
  });

  const { data: detailData } = useQuery({
    queryKey: ["admin-expense-report-detail", selectedId],
    queryFn: () => selectedId ? api.finance.getReport(selectedId) : null,
    enabled: !!selectedId,
  });

  const reports = data?.items ?? [];
  const selectedReport = detailData ?? null;
  const analytics = analyticsData ?? null;

  const submitted = analytics?.byStatus?.SUBMITTED ?? 0;
  const approved = analytics?.byStatus?.APPROVED ?? 0;
  const rejected = analytics?.byStatus?.REJECTED ?? 0;
  const needsChanges = analytics?.byStatus?.NEEDS_CHANGES ?? 0;

  return (
    <RoleGuard allowed={["ADMIN"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-seekop-100 flex items-center justify-center">
                <BarChart3 size={22} className="text-seekop-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Control de Gastos</h1>
                <p className="text-sm text-gray-500">Vista global de todos los reportes de gastos</p>
              </div>
            </div>
          </div>
        </div>

        {/* Analytics KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { label: "Total reportes", value: analytics?.totalReports ?? 0, icon: <Receipt size={18} className="text-seekop-600" />, bg: "bg-seekop-50" },
            { label: "Total tickets", value: analytics?.totalReceipts ?? 0, icon: <FileText size={18} className="text-gray-600" />, bg: "bg-gray-50" },
            { label: "Pendientes", value: submitted, icon: <Clock size={18} className="text-blue-600" />, bg: "bg-blue-50" },
            { label: "Aprobados", value: approved, icon: <CheckCircle size={18} className="text-emerald-600" />, bg: "bg-emerald-50" },
            { label: "Rechazados", value: rejected + needsChanges, icon: <AlertTriangle size={18} className="text-red-600" />, bg: "bg-red-50" },
            { label: "Monto global", value: `$${(analytics?.totalAmount ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, icon: <DollarSign size={18} className="text-emerald-600" />, bg: "bg-emerald-50" },
          ].map((k, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-3.5 flex items-center gap-3 shadow-sm">
              <div className={`w-10 h-10 rounded-lg ${k.bg} flex items-center justify-center shrink-0`}>{k.icon}</div>
              <div><p className="text-lg font-bold text-gray-800">{k.value}</p><p className="text-[10px] text-gray-500 uppercase tracking-wider">{k.label}</p></div>
            </div>
          ))}
        </div>

        {/* Category & Vendor analytics cards */}
        {analytics && (Object.keys(analytics.byCategory).length > 0 || analytics.topVendors.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.keys(analytics.byCategory).length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5"><TrendingUp size={14} /> Gasto por categoría</h3>
                <div className="space-y-2">
                  {Object.entries(analytics.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
                    const max = Math.max(...Object.values(analytics.byCategory));
                    return (
                      <div key={cat} className="flex items-center gap-3">
                        <span className="text-xs text-gray-600 w-28 shrink-0">{CAT_LABELS[cat] ?? cat}</span>
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
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            <span className="text-xs text-gray-500 font-medium">Estado:</span>
            {["", "SUBMITTED", "APPROVED", "REJECTED", "NEEDS_CHANGES", "DRAFT"].map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setSelectedId(null); }}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === s ? "bg-seekop-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {s ? (STATUS_MAP[s]?.label ?? s) : "Todos"}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSelectedId(null); }}
              placeholder="Buscar por título..."
              className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-seekop-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Master-detail layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Report list */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-4 py-2.5 border-b border-gray-100">
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Reportes ({reports.length})</h3>
            </div>
            {isLoading ? (
              <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-gray-300" size={24} /></div>
            ) : reports.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">Sin reportes.</div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
                {reports.map((r) => {
                  const st = STATUS_MAP[r.status] ?? STATUS_MAP.DRAFT;
                  const active = selectedId === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className={`w-full text-left px-4 py-3 transition-colors ${active ? "bg-seekop-50 border-l-[3px] border-seekop-500" : "hover:bg-gray-50 border-l-[3px] border-transparent"}`}
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-800 truncate flex-1">{r.title}</p>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium shrink-0 border ${st.color} ${st.border}`}>{st.label}</span>
                      </div>
                      <div className="flex gap-3 text-xs text-gray-500 mt-1">
                        <span className="flex items-center gap-0.5"><Users size={10} /> {r.ownerName ?? "—"}</span>
                        {r.totalAmount != null && <span className="font-semibold text-gray-700">${r.totalAmount.toFixed(2)}</span>}
                        <span>{r.receiptCount ?? r.receipts?.length ?? 0} tickets</span>
                      </div>
                      {r.decisionComment && (
                        <p className="text-[11px] text-amber-600 mt-1 truncate">💬 {r.decisionComment}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-3">
            {selectedReport ? (
              <ReportDetailPanel report={selectedReport} onViewReceipt={setPreviewReceipt} />
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                <Eye size={40} className="mx-auto mb-3 text-gray-200" />
                <p className="text-sm text-gray-400">Selecciona un reporte para ver detalles</p>
                <p className="text-xs text-gray-300 mt-1">Incluye tickets, montos e historial de decisiones</p>
              </div>
            )}
          </div>
        </div>

        {/* Receipt preview modal */}
        {previewReceipt && <ReceiptPreviewModal receipt={previewReceipt} onClose={() => setPreviewReceipt(null)} />}
      </div>
    </RoleGuard>
  );
}

/* ── Report Detail Panel ─────────────────────────────── */
function ReportDetailPanel({ report, onViewReceipt }: { report: ExpenseReport; onViewReceipt: (r: ExpenseReceipt) => void }) {
  const st = STATUS_MAP[report.status] ?? STATUS_MAP.DRAFT;
  const receipts = report.receipts ?? [];
  const totalSum = receipts.reduce((s, r) => s + (r.totalAmount ?? 0), 0);
  const totalTax = receipts.reduce((s, r) => s + (r.taxAmount ?? 0), 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">{report.title}</h3>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${st.color} ${st.border}`}>{st.label}</span>
            </div>
            <div className="flex gap-4 text-xs text-gray-500 mt-1.5">
              <span className="flex items-center gap-1"><Users size={12} /> <strong className="text-gray-700">{report.ownerName ?? "—"}</strong></span>
              {report.teamName && <span className="flex items-center gap-1"><Building2 size={12} /> {report.teamName}</span>}
              <span>{report.periodStart} — {report.periodEnd}</span>
            </div>
          </div>
          <a
            href={api.finance.exportReportUrl(report.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 bg-seekop-600 text-white rounded-lg text-xs font-medium hover:bg-seekop-700 transition-colors"
          >
            <Download size={13} /> CSV
          </a>
        </div>
        {report.decisionComment && (
          <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-700"><strong>Comentario de Finanzas:</strong> {report.decisionComment}</p>
          </div>
        )}
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-0 border-b border-gray-100">
        <div className="px-5 py-3 text-center border-r border-gray-100">
          <p className="text-lg font-bold text-seekop-700">${totalSum.toFixed(2)}</p>
          <p className="text-[10px] text-gray-500 uppercase">Subtotal</p>
        </div>
        <div className="px-5 py-3 text-center border-r border-gray-100">
          <p className="text-lg font-bold text-gray-600">${totalTax.toFixed(2)}</p>
          <p className="text-[10px] text-gray-500 uppercase">Impuestos</p>
        </div>
        <div className="px-5 py-3 text-center">
          <p className="text-lg font-bold text-emerald-700">{receipts.length}</p>
          <p className="text-[10px] text-gray-500 uppercase">Tickets</p>
        </div>
      </div>

      {/* Receipts table */}
      {receipts.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">Sin tickets en este reporte.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100 bg-gray-50/50">
                <th className="py-2 pl-5 pr-2 w-9"></th>
                <th className="py-2 pr-3 font-medium">Proveedor</th>
                <th className="py-2 pr-3 font-medium">Fecha</th>
                <th className="py-2 pr-3 font-medium">Categoría</th>
                <th className="py-2 pr-3 font-medium text-right">Monto</th>
                <th className="py-2 pr-5 font-medium text-center">IA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {receipts.map((r) => {
                const ext = EXT_BADGE[r.extractionStatus] ?? EXT_BADGE.PENDING;
                const isManual = r.fileContentType === "application/manual";
                return (
                  <tr key={r.id} onClick={() => onViewReceipt(r)} className="hover:bg-seekop-50/30 cursor-pointer transition-colors">
                    <td className="py-2 pl-5 pr-2">
                      <div className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center overflow-hidden ring-1 ring-gray-200">
                        {isManual ? (
                          <span className="text-[9px] font-bold text-emerald-600">M</span>
                        ) : r.fileContentType.startsWith("image/") ? (
                          <img src={getAuthFileUrl(r.fileUrl)} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <FileText size={12} className="text-gray-400" />
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-3 font-medium text-gray-700">{r.vendorName || r.fileName}</td>
                    <td className="py-2 pr-3 text-gray-500">{r.receiptDate ?? "—"}</td>
                    <td className="py-2 pr-3"><span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px]">{CAT_LABELS[r.category ?? ""] ?? r.category ?? "—"}</span></td>
                    <td className="py-2 pr-3 text-right font-semibold text-gray-800">{r.totalAmount != null ? `$${r.totalAmount.toFixed(2)}` : "—"}</td>
                    <td className="py-2 pr-5 text-center">
                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${ext.color}`}>{ext.icon}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Receipt Preview Modal ────────────────────────────── */
function ReceiptPreviewModal({ receipt, onClose }: { receipt: ExpenseReceipt; onClose: () => void }) {
  const isImage = receipt.fileContentType.startsWith("image/");
  const isManual = receipt.fileContentType === "application/manual";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{receipt.vendorName || receipt.fileName}</h2>
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
              {receipt.totalAmount != null && <span className="font-semibold text-gray-700">${receipt.totalAmount.toFixed(2)} {receipt.currency}</span>}
              {receipt.category && <span>{CAT_LABELS[receipt.category] ?? receipt.category}</span>}
              {receipt.receiptDate && <span>{receipt.receiptDate}</span>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {isManual ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-emerald-600" />
              </div>
              <p className="text-sm text-gray-600">Este ticket fue capturado manualmente.</p>
              <div className="mt-4 grid grid-cols-2 gap-3 max-w-md mx-auto text-left">
                {[
                  ["Proveedor", receipt.vendorName],
                  ["Fecha", receipt.receiptDate],
                  ["Monto", receipt.totalAmount != null ? `$${receipt.totalAmount.toFixed(2)}` : null],
                  ["Impuestos", receipt.taxAmount != null ? `$${receipt.taxAmount.toFixed(2)}` : null],
                  ["Categoría", receipt.category ? CAT_LABELS[receipt.category] ?? receipt.category : null],
                  ["Método", receipt.paymentMethod],
                  ["Descripción", receipt.description],
                ].filter(([, v]) => v).map(([l, v]) => (
                  <div key={l as string}>
                    <p className="text-[10px] text-gray-400 uppercase">{l}</p>
                    <p className="text-sm font-medium text-gray-700">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : isImage ? (
            <img src={getAuthFileUrl(receipt.fileUrl)} alt="Ticket" className="max-w-full max-h-[60vh] rounded-lg shadow-md mx-auto object-contain" />
          ) : (
            <div className="text-center py-12">
              <FileText size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">Archivo PDF</p>
              <a href={getAuthFileUrl(receipt.fileUrl)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 bg-seekop-600 text-white rounded-lg text-sm font-medium hover:bg-seekop-700 transition-colors">
                <Eye size={14} /> Abrir PDF
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
