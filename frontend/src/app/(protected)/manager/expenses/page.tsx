"use client";

import React, { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import RoleGuard from "@/components/layout/RoleGuard";
import {
  Upload, Receipt, FileText, XCircle, Clock, Loader2,
  RefreshCw, Send, Plus, Sparkles, X, Trash2,
  Save, Eye, ChevronRight, DollarSign, PenLine,
  RotateCcw, CheckCircle, AlertTriangle, ImageOff, Search,
} from "lucide-react";
import api from "@/api/client";
import type { ExpenseReceipt, ExpenseReport } from "@/api/real/client";
import { useToast } from "@/components/ui/Toast";

type Tab = "tickets" | "reports";
type AddMode = "upload" | "manual" | null;

const API_BASE = "/api/v1";

const EXTRACTION_STATUS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING: { label: "Pendiente", color: "bg-gray-100 text-gray-600", icon: <Clock size={14} /> },
  PROCESSING: { label: "Procesando IA...", color: "bg-seekop-100 text-seekop-800", icon: <Loader2 size={14} className="animate-spin" /> },
  DONE: { label: "Extraído", color: "bg-emerald-100 text-emerald-700", icon: <Sparkles size={14} /> },
  FAILED: { label: "Error IA", color: "bg-red-100 text-red-700", icon: <XCircle size={14} /> },
};

const REPORT_STATUS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Borrador", color: "bg-gray-100 text-gray-700 border-gray-200" },
  SUBMITTED: { label: "Enviado", color: "bg-blue-50 text-blue-700 border-blue-200" },
  APPROVED: { label: "Aprobado", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  REJECTED: { label: "Rechazado", color: "bg-red-50 text-red-700 border-red-200" },
  NEEDS_CHANGES: { label: "Requiere cambios", color: "bg-amber-50 text-amber-700 border-amber-200" },
};

const CATEGORY_LABELS: Record<string, string> = {
  GASOLINE: "Gasolina", TOLLS: "Casetas", FOOD: "Comida", HOTEL: "Hotel",
  TRANSPORT: "Transporte", PARKING: "Estacionamiento", SUPPLIES: "Insumos", OTHER: "Otro",
};

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS);

/** Build an authenticated file URL for <img> tags (appends token as query param).
 *  fileUrl already includes /api/v1/... — use relative path so Next.js proxy handles it. */
function getAuthFileUrl(fileUrl: string): string {
  if (!fileUrl || fileUrl === "manual") return "";
  const token = typeof window !== "undefined" ? localStorage.getItem("vc_token") : null;
  return token ? `${fileUrl}${fileUrl.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}` : fileUrl;
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Efectivo", CARD: "Tarjeta", TRANSFER: "Transferencia", UNKNOWN: "Desconocido",
};

/* ================================================================
   MAIN PAGE
   ================================================================ */
export default function ManagerExpensesPage() {
  const [tab, setTab] = useState<Tab>("tickets");
  const [detailReceipt, setDetailReceipt] = useState<ExpenseReceipt | null>(null);

  const { data: receiptsData } = useQuery({
    queryKey: ["my-receipts"],
    queryFn: () => api.expenses.listReceipts({ pageSize: 200 }),
    refetchInterval: 5000,
  });
  const { data: reportsData } = useQuery({
    queryKey: ["my-reports"],
    queryFn: () => api.expenses.listReports({ pageSize: 200 }),
  });

  const receipts = receiptsData?.items ?? [];
  const reports = reportsData?.items ?? [];
  const totalExpensed = receipts.reduce((s, r) => s + (r.totalAmount ?? 0), 0);
  const unassigned = receipts.filter((r) => !r.reportId).length;
  const pendingAI = receipts.filter((r) => r.extractionStatus === "PENDING" || r.extractionStatus === "PROCESSING").length;
  const submitted = reports.filter((r) => r.status === "SUBMITTED").length;
  const needsChanges = reports.filter((r) => r.status === "NEEDS_CHANGES").length;

  return (
    <RoleGuard allowed={["MANAGER"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gastos / Viáticos</h1>
            <p className="text-sm text-gray-500 mt-1">Sube tickets con IA o captura manual, crea reportes y envía a Finanzas</p>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Tickets", value: receipts.length, icon: <Receipt size={18} className="text-seekop-600" />, bg: "bg-seekop-50" },
            { label: "Monto total", value: `$${totalExpensed.toFixed(0)}`, icon: <DollarSign size={18} className="text-emerald-600" />, bg: "bg-emerald-50" },
            { label: "Sin asignar", value: unassigned, icon: <AlertTriangle size={18} className="text-amber-600" />, bg: "bg-amber-50" },
            { label: "IA procesando", value: pendingAI, icon: <Sparkles size={18} className="text-blue-600" />, bg: "bg-blue-50" },
            { label: needsChanges > 0 ? "Req. cambios" : "Enviados", value: needsChanges > 0 ? needsChanges : submitted, icon: needsChanges > 0 ? <AlertTriangle size={18} className="text-red-600" /> : <Send size={18} className="text-seekop-600" />, bg: needsChanges > 0 ? "bg-red-50" : "bg-seekop-50" },
          ].map((k, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-3.5 flex items-center gap-3 shadow-sm">
              <div className={`w-10 h-10 rounded-lg ${k.bg} flex items-center justify-center shrink-0`}>{k.icon}</div>
              <div><p className="text-xl font-bold text-gray-800">{k.value}</p><p className="text-[11px] text-gray-500">{k.label}</p></div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {([
            { key: "tickets" as Tab, label: "Mis Tickets", icon: <Receipt size={16} />, count: receipts.length },
            { key: "reports" as Tab, label: "Mis Reportes", icon: <FileText size={16} />, count: reports.length },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                tab === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.icon} {t.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? "bg-seekop-100 text-seekop-700" : "bg-gray-200 text-gray-500"}`}>{t.count}</span>
            </button>
          ))}
        </div>

        {tab === "tickets" && <TicketsTab onViewDetail={setDetailReceipt} />}
        {tab === "reports" && <ReportsTab onViewReceipt={setDetailReceipt} />}

        {detailReceipt && (
          <ReceiptDetailModal receipt={detailReceipt} onClose={() => setDetailReceipt(null)} />
        )}
      </div>
    </RoleGuard>
  );
}

/* ================================================================
   TICKETS TAB — Upload + Manual + List
   ================================================================ */
function TicketsTab({ onViewDetail }: { onViewDetail: (r: ExpenseReceipt) => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["my-receipts"],
    queryFn: () => api.expenses.listReceipts({ pageSize: 200 }),
    refetchInterval: 5000,
  });

  const allReceipts = data?.items ?? [];
  const receipts = searchTerm
    ? allReceipts.filter((r) =>
        (r.vendorName ?? r.fileName).toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.category ?? "").toLowerCase().includes(searchTerm.toLowerCase())
      )
    : allReceipts;
  const hasProcessing = allReceipts.some((r) => r.extractionStatus === "PENDING" || r.extractionStatus === "PROCESSING");

  const handleFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const valid = files.filter((f) => f.size <= 10 * 1024 * 1024);
    if (valid.length < files.length) toast("error", `${files.length - valid.length} archivo(s) exceden 10 MB.`);
    if (valid.length > 10) { toast("error", "Máximo 10 archivos a la vez."); return; }
    if (!valid.length) return;
    setUploading(true);
    try {
      await api.expenses.uploadReceipts(valid);
      toast("success", `${valid.length} ticket(s) subido(s). La IA está extrayendo datos...`);
      queryClient.invalidateQueries({ queryKey: ["my-receipts"] });
      setAddMode(null);
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Error al subir archivos.");
    } finally {
      setUploading(false);
    }
  }, [toast, queryClient]);

  const onDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); handleFiles(Array.from(e.dataTransfer.files)); }, [handleFiles]);
  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { handleFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }, [handleFiles]);

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.expenses.deleteReceipt(id),
    onSuccess: () => { toast("success", "Ticket eliminado."); queryClient.invalidateQueries({ queryKey: ["my-receipts"] }); },
    onError: (e: unknown) => toast("error", e instanceof Error ? e.message : "Error al eliminar."),
  });

  const reExtractMut = useMutation({
    mutationFn: (id: string) => api.expenses.reExtractReceipt(id),
    onSuccess: () => { toast("success", "Re-extracción iniciada."); queryClient.invalidateQueries({ queryKey: ["my-receipts"] }); },
    onError: (e: unknown) => toast("error", e instanceof Error ? e.message : "Error."),
  });

  return (
    <div className="space-y-4">
      {/* Add mode selector */}
      {!addMode && (
        <div className="flex gap-3">
          <button onClick={() => setAddMode("upload")} className="flex-1 flex items-center gap-3 p-4 bg-white rounded-xl border-2 border-dashed border-gray-300 hover:border-seekop-400 hover:bg-seekop-50/30 transition-all group">
            <div className="w-11 h-11 rounded-xl bg-seekop-100 flex items-center justify-center group-hover:bg-seekop-200 transition-colors">
              <Upload size={20} className="text-seekop-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-800">Subir Imagen / PDF</p>
              <p className="text-xs text-gray-500">La IA extraerá los datos automáticamente</p>
            </div>
          </button>
          <button onClick={() => setAddMode("manual")} className="flex-1 flex items-center gap-3 p-4 bg-white rounded-xl border-2 border-dashed border-gray-300 hover:border-emerald-400 hover:bg-emerald-50/30 transition-all group">
            <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
              <PenLine size={20} className="text-emerald-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-800">Captura Manual</p>
              <p className="text-xs text-gray-500">Ingresa los datos del gasto directamente</p>
            </div>
          </button>
        </div>
      )}

      {/* Upload zone */}
      {addMode === "upload" && (
        <div className="space-y-2">
          <div className="flex justify-end">
            <button onClick={() => setAddMode(null)} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"><X size={14} /> Cerrar</button>
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${isDragging ? "border-seekop-500 bg-seekop-50 scale-[1.01]" : "border-gray-300 hover:border-seekop-400 hover:bg-gray-50"}`}
          >
            <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf,text/xml,application/xml,.xml" className="hidden" onChange={onFileSelect} />
            {uploading ? (
              <div className="flex flex-col items-center gap-2"><Loader2 className="animate-spin text-seekop-600" size={32} /><p className="text-sm text-seekop-700 font-medium">Subiendo archivos...</p></div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-full bg-seekop-100 flex items-center justify-center"><Upload className="text-seekop-600" size={24} /></div>
                <p className="text-sm font-medium text-gray-700">Arrastra tus tickets aquí o <span className="text-seekop-600 hover:underline">haz clic para seleccionar</span></p>
                <p className="text-xs text-gray-400">JPG, PNG, WebP, PDF o XML (CFDI) — máx. 10 MB, hasta 10 a la vez</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual entry form */}
      {addMode === "manual" && <ManualEntryForm onDone={() => { setAddMode(null); queryClient.invalidateQueries({ queryKey: ["my-receipts"] }); }} onCancel={() => setAddMode(null)} />}

      {/* Ticket List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 gap-3">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 shrink-0">
            Mis Tickets
            {hasProcessing && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-seekop-100 text-seekop-700 animate-pulse">
                <Loader2 size={12} className="animate-spin" /> IA procesando
              </span>
            )}
          </h3>
          <div className="flex items-center gap-2 flex-1 max-w-xs">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar..." className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-seekop-500 focus:border-transparent" />
            </div>
            <button onClick={() => refetch()} className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"><RefreshCw size={15} /></button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-gray-300" size={28} /></div>
        ) : receipts.length === 0 ? (
          <div className="p-10 text-center">
            <Receipt size={36} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-400">{searchTerm ? "Sin resultados." : "No tienes tickets aún. Sube o captura tu primer gasto."}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {receipts.map((r) => (
              <TicketRow
                key={r.id}
                receipt={r}
                onView={() => onViewDetail(r)}
                onDelete={() => { if (confirm("¿Eliminar este ticket?")) deleteMut.mutate(r.id); }}
                onReExtract={() => reExtractMut.mutate(r.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Manual Entry Form ──────────────────────────────── */
function ManualEntryForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vendorName: "", receiptDate: "", totalAmount: "", currency: "MXN",
    taxAmount: "", paymentMethod: "", category: "", description: "",
  });

  const handleSave = async () => {
    if (!form.vendorName || !form.receiptDate || !form.totalAmount) {
      toast("error", "Proveedor, fecha y monto son obligatorios.");
      return;
    }
    setSaving(true);
    try {
      await api.expenses.createManualReceipt({
        vendorName: form.vendorName,
        receiptDate: form.receiptDate,
        totalAmount: parseFloat(form.totalAmount),
        currency: form.currency || "MXN",
        taxAmount: form.taxAmount ? parseFloat(form.taxAmount) : undefined,
        paymentMethod: form.paymentMethod || undefined,
        category: form.category || undefined,
        description: form.description || undefined,
      });
      toast("success", "Ticket manual creado exitosamente.");
      onDone();
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Error al crear ticket.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-emerald-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center"><PenLine size={18} className="text-emerald-600" /></div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Captura Manual de Gasto</h3>
            <p className="text-xs text-gray-500">Ingresa los datos sin necesidad de subir imagen</p>
          </div>
        </div>
        <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"><X size={18} /></button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">Proveedor *</label>
          <input value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} placeholder="Nombre del proveedor" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-seekop-500 focus:border-transparent" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Fecha *</label>
          <input type="date" value={form.receiptDate} onChange={(e) => setForm({ ...form, receiptDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-seekop-500 focus:border-transparent" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Monto *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
            <input type="number" step="0.01" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} placeholder="0.00" className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-seekop-500 focus:border-transparent" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Impuestos</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
            <input type="number" step="0.01" value={form.taxAmount} onChange={(e) => setForm({ ...form, taxAmount: e.target.value })} placeholder="0.00" className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-seekop-500 focus:border-transparent" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Categoría</label>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-seekop-500 focus:border-transparent">
            <option value="">— Seleccionar —</option>
            {CATEGORY_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Método de pago</label>
          <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-seekop-500 focus:border-transparent">
            <option value="">— Seleccionar —</option>
            {Object.entries(PAYMENT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div className="col-span-2 md:col-span-4">
          <label className="block text-xs font-medium text-gray-500 mb-1">Descripción</label>
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Notas o descripción del gasto" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-seekop-500 focus:border-transparent" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar Ticket
        </button>
      </div>
    </div>
  );
}

/* ── Ticket Row ──────────────────────────────────────── */
function TicketRow({ receipt, onView, onDelete, onReExtract }: { receipt: ExpenseReceipt; onView: () => void; onDelete: () => void; onReExtract: () => void }) {
  const st = EXTRACTION_STATUS[receipt.extractionStatus] ?? EXTRACTION_STATUS.PENDING;
  const isManual = receipt.fileContentType === "application/manual";
  const canDelete = !receipt.reportId;
  const canReExtract = !isManual && (receipt.extractionStatus === "FAILED" || receipt.extractionStatus === "DONE");

  return (
    <div className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors group">
      {/* Thumbnail */}
      <div className="w-11 h-11 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-gray-200 cursor-pointer" onClick={onView}>
        {isManual ? (
          <PenLine size={18} className="text-emerald-500" />
        ) : receipt.fileContentType.startsWith("image/") ? (
          <img src={getAuthFileUrl(receipt.fileUrl)} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <FileText size={18} className="text-gray-400" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onView}>
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-800 truncate">{receipt.vendorName || receipt.fileName}</p>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${st.color}`}>{st.icon} {st.label}</span>
          {isManual && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-200">Manual</span>}
          {receipt.isCfdi && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">CFDI</span>}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
          {receipt.totalAmount != null && <span className="font-semibold text-gray-700">${receipt.totalAmount.toFixed(2)} {receipt.currency}</span>}
          {receipt.category && <span>{CATEGORY_LABELS[receipt.category] ?? receipt.category}</span>}
          {receipt.receiptDate && <span>{receipt.receiptDate}</span>}
          {receipt.rfcEmisor && <span className="text-blue-600">RFC: {receipt.rfcEmisor}</span>}
          {!receipt.reportId ? <span className="text-amber-600 font-medium">Sin asignar</span> : <span className="text-seekop-600">Asignado</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {canReExtract && (
          <button onClick={(e) => { e.stopPropagation(); onReExtract(); }} title="Re-extraer con IA" className="p-1.5 rounded-md text-gray-400 hover:text-seekop-600 hover:bg-seekop-50 transition-colors">
            <RotateCcw size={14} />
          </button>
        )}
        {canDelete && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Eliminar ticket" className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            <Trash2 size={14} />
          </button>
        )}
        <button onClick={onView} className="p-1.5 rounded-md text-gray-400 hover:text-seekop-600 hover:bg-seekop-50 transition-colors">
          <Eye size={14} />
        </button>
      </div>
    </div>
  );
}

/* ================================================================
   RECEIPT DETAIL MODAL — Image + AI fields + Edit
   ================================================================ */
function ReceiptDetailModal({ receipt, onClose }: { receipt: ExpenseReceipt; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    vendorName: receipt.vendorName ?? "",
    receiptDate: receipt.receiptDate ?? "",
    totalAmount: receipt.totalAmount != null ? String(receipt.totalAmount) : "",
    currency: receipt.currency ?? "MXN",
    taxAmount: receipt.taxAmount != null ? String(receipt.taxAmount) : "",
    paymentMethod: receipt.paymentMethod ?? "",
    category: receipt.category ?? "",
    description: receipt.description ?? "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.expenses.updateReceipt(receipt.id, {
        vendorName: form.vendorName || undefined,
        receiptDate: form.receiptDate || undefined,
        totalAmount: form.totalAmount ? parseFloat(form.totalAmount) : undefined,
        currency: form.currency || undefined,
        taxAmount: form.taxAmount ? parseFloat(form.taxAmount) : undefined,
        paymentMethod: form.paymentMethod || undefined,
        category: form.category || undefined,
        description: form.description || undefined,
      });
      toast("success", "Ticket actualizado.");
      queryClient.invalidateQueries({ queryKey: ["my-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["my-reports"] });
      queryClient.invalidateQueries({ queryKey: ["my-report-detail"] });
      setEditing(false);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al guardar.";
      toast("error", msg);
    } finally {
      setSaving(false);
    }
  };

  const isManual = receipt.fileContentType === "application/manual";
  const isImage = !isManual && receipt.fileContentType.startsWith("image/");
  const isPdf = !isManual && receipt.fileContentType === "application/pdf";
  const confidence = receipt.extractionConfidence;
  const canEdit = receipt.extractionStatus === "DONE" || receipt.extractionStatus === "FAILED" || isManual;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">{receipt.vendorName || receipt.fileName}</h2>
              {isManual && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">Manual</span>
              )}
              {receipt.isCfdi && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-200">CFDI</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1">
              {(() => {
                const st = EXTRACTION_STATUS[receipt.extractionStatus] ?? EXTRACTION_STATUS.PENDING;
                return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.icon} {st.label}</span>;
              })()}
              {confidence != null && (
                <span className={`text-xs font-medium ${confidence >= 0.8 ? "text-emerald-600" : confidence >= 0.5 ? "text-amber-600" : "text-red-500"}`}>
                  Confianza: {(confidence * 100).toFixed(0)}%
                </span>
              )}
              {receipt.totalAmount != null && (
                <span className="text-sm font-bold text-gray-800">${receipt.totalAmount.toFixed(2)} {receipt.currency}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className={`grid gap-0 ${isManual ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2 lg:divide-x divide-gray-100"}`}>
            {/* Left: Image/PDF/Manual preview */}
            {isManual ? (
              <div className="px-6 pt-4 pb-2">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                    <PenLine size={20} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-emerald-800">Ticket capturado manualmente</p>
                    <p className="text-xs text-emerald-600">Este gasto fue ingresado sin imagen o PDF adjunto.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-gray-50 flex items-center justify-center min-h-[300px]">
                {isImage ? (
                  <img
                    src={getAuthFileUrl(receipt.fileUrl)}
                    alt="Ticket"
                    className="max-w-full max-h-[60vh] rounded-lg shadow-md object-contain"
                    onError={(e) => {
                      const el = e.target as HTMLImageElement;
                      el.style.display = "none";
                      el.parentElement!.innerHTML = '<div class="text-center py-8"><p class="text-sm text-gray-400">No se pudo cargar la imagen</p></div>';
                    }}
                  />
                ) : isPdf ? (
                  <div className="text-center">
                    <FileText size={48} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-sm text-gray-500">Archivo PDF</p>
                    <a
                      href={getAuthFileUrl(receipt.fileUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 bg-seekop-600 text-white rounded-lg text-sm font-medium hover:bg-seekop-700 transition-colors"
                    >
                      <Eye size={14} /> Abrir PDF
                    </a>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText size={40} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-sm text-gray-400">Vista previa no disponible</p>
                  </div>
                )}
              </div>
            )}

            {/* Right: Extracted data / Edit form */}
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">
                  {isManual ? "Datos del gasto" : "Datos extraídos por IA"}
                </h3>
                {canEdit && !editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1 text-xs text-seekop-600 hover:text-seekop-700 font-medium px-2.5 py-1 rounded-md hover:bg-seekop-50 transition-colors"
                  >
                    <PenLine size={12} /> Editar
                  </button>
                )}
              </div>

              {!canEdit && receipt.extractionStatus !== "FAILED" ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                  <Loader2 size={32} className="animate-spin mb-3" />
                  <p className="text-sm">La IA está procesando este ticket...</p>
                  <p className="text-xs mt-1">Los datos aparecerán cuando termine.</p>
                </div>
              ) : receipt.extractionStatus === "FAILED" && !editing ? (
                <div className="py-8 text-center">
                  <XCircle size={32} className="mx-auto text-red-300 mb-2" />
                  <p className="text-sm text-red-600">La extracción falló.</p>
                  <button onClick={() => setEditing(true)} className="mt-3 inline-flex items-center gap-1 text-sm text-seekop-600 hover:underline font-medium">
                    <PenLine size={13} /> Llenar manualmente
                  </button>
                </div>
              ) : null}

              {(canEdit || editing) && (
                <div className="grid grid-cols-2 gap-3">
                  <FieldItem label="Proveedor" value={form.vendorName} editing={editing} onChange={(v) => setForm({ ...form, vendorName: v })} />
                  <FieldItem label="Fecha" value={form.receiptDate} editing={editing} type="date" onChange={(v) => setForm({ ...form, receiptDate: v })} />
                  <FieldItem label="Total" value={form.totalAmount} editing={editing} type="number" prefix="$" onChange={(v) => setForm({ ...form, totalAmount: v })} />
                  <FieldItem label="Moneda" value={form.currency} editing={editing} onChange={(v) => setForm({ ...form, currency: v })} />
                  <FieldItem label="Impuestos" value={form.taxAmount} editing={editing} type="number" prefix="$" onChange={(v) => setForm({ ...form, taxAmount: v })} />
                  <FieldSelect label="Método de pago" value={form.paymentMethod} editing={editing} options={Object.entries(PAYMENT_LABELS)} onChange={(v) => setForm({ ...form, paymentMethod: v })} />
                  <FieldSelect label="Categoría" value={form.category} editing={editing} options={CATEGORY_OPTIONS} onChange={(v) => setForm({ ...form, category: v })} />
                  <FieldItem label="Descripción" value={form.description} editing={editing} onChange={(v) => setForm({ ...form, description: v })} full />
                </div>
              )}

              {editing && (
                <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                  <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors rounded-lg hover:bg-gray-100">
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-5 py-2 bg-seekop-600 text-white rounded-lg text-sm font-medium hover:bg-seekop-700 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Guardar cambios
                  </button>
                </div>
              )}

              {receipt.isCfdi && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                  <h4 className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Datos Fiscales (CFDI)</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {receipt.uuidFiscal && (
                      <div className="col-span-2">
                        <span className="text-blue-600 font-medium">UUID Fiscal:</span>{" "}
                        <span className="text-gray-800 font-mono text-[11px]">{receipt.uuidFiscal}</span>
                      </div>
                    )}
                    {receipt.rfcEmisor && (
                      <div>
                        <span className="text-blue-600 font-medium">RFC Emisor:</span>{" "}
                        <span className="text-gray-800 font-mono">{receipt.rfcEmisor}</span>
                      </div>
                    )}
                    {receipt.rfcReceptor && (
                      <div>
                        <span className="text-blue-600 font-medium">RFC Receptor:</span>{" "}
                        <span className="text-gray-800 font-mono">{receipt.rfcReceptor}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Field helpers for modal ─────────────────────────── */
function FieldItem({ label, value, editing, onChange, type = "text", prefix, full }: {
  label: string; value: string; editing: boolean; onChange: (v: string) => void;
  type?: string; prefix?: string; full?: boolean;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <p className="text-[11px] font-medium text-gray-400 mb-1">{label}</p>
      {editing ? (
        <div className="relative">
          {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">{prefix}</span>}
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-seekop-500 focus:border-transparent ${prefix ? "pl-6" : ""}`}
          />
        </div>
      ) : (
        <p className="text-sm font-medium text-gray-700">
          {prefix && value ? `${prefix}${value}` : value || "—"}
        </p>
      )}
    </div>
  );
}

function FieldSelect({ label, value, editing, options, onChange }: {
  label: string; value: string; editing: boolean;
  options: [string, string][]; onChange: (v: string) => void;
}) {
  const displayLabel = options.find(([k]) => k === value)?.[1] ?? value;
  return (
    <div>
      <p className="text-[11px] font-medium text-gray-400 mb-1">{label}</p>
      {editing ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-seekop-500 focus:border-transparent"
        >
          <option value="">— Seleccionar —</option>
          {options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      ) : (
        <p className="text-sm font-medium text-gray-700">{displayLabel || "—"}</p>
      )}
    </div>
  );
}

/* ================================================================
   REPORTS TAB — Create + List + Detail + Submit
   ================================================================ */
function ReportsTab({ onViewReceipt }: { onViewReceipt: (r: ExpenseReceipt) => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);

  const { data: reportsData, isLoading } = useQuery({
    queryKey: ["my-reports"],
    queryFn: () => api.expenses.listReports({ pageSize: 50 }),
  });

  const { data: unassignedData } = useQuery({
    queryKey: ["my-receipts-unassigned"],
    queryFn: () => api.expenses.listReceipts({ unassigned: true, pageSize: 100 }),
  });

  const reports = reportsData?.items ?? [];
  const unassignedReceipts = unassignedData?.items ?? [];

  const submitMutation = useMutation({
    mutationFn: (id: string) => api.expenses.submitReport(id),
    onSuccess: () => {
      toast("success", "Reporte enviado a Finanzas para revisión.");
      queryClient.invalidateQueries({ queryKey: ["my-reports"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Error al enviar.";
      toast("error", msg);
    },
  });

  const invalidateAll = () => {
    setShowCreate(false);
    queryClient.invalidateQueries({ queryKey: ["my-reports"] });
    queryClient.invalidateQueries({ queryKey: ["my-receipts-unassigned"] });
    queryClient.invalidateQueries({ queryKey: ["my-receipts"] });
  };

  return (
    <div className="space-y-4">
      {!showCreate ? (
        <button
          onClick={() => setShowCreate(true)}
          disabled={unassignedReceipts.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-seekop-600 text-white rounded-lg text-sm font-medium hover:bg-seekop-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          <Plus size={16} /> Crear Reporte
          {unassignedReceipts.length > 0 && (
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{unassignedReceipts.length} tickets disponibles</span>
          )}
        </button>
      ) : (
        <CreateReportForm unassignedReceipts={unassignedReceipts} onCancel={() => setShowCreate(false)} onCreated={invalidateAll} />
      )}

      {/* Reports list */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">
            Mis Reportes <span className="text-xs font-normal text-gray-400">({reports.length})</span>
          </h3>
        </div>
        {isLoading ? (
          <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-gray-300" size={28} /></div>
        ) : reports.length === 0 ? (
          <div className="p-10 text-center">
            <FileText size={36} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-400">No tienes reportes. Sube tickets y crea tu primer reporte.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {reports.map((r) => (
              <ReportRow
                key={r.id}
                report={r}
                onSubmit={() => submitMutation.mutate(r.id)}
                submitting={submitMutation.isPending}
                onViewReceipt={onViewReceipt}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Report Row (expandable) ─────────────────────────── */
function ReportRow({ report, onSubmit, submitting, onViewReceipt }: {
  report: ExpenseReport; onSubmit: () => void; submitting: boolean; onViewReceipt: (r: ExpenseReceipt) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const st = REPORT_STATUS[report.status] ?? REPORT_STATUS.DRAFT;
  const canSubmit = report.status === "DRAFT" || report.status === "NEEDS_CHANGES";
  const isNeedsChanges = report.status === "NEEDS_CHANGES";

  // Fetch full report detail with receipts when expanded
  const { data: fullReport } = useQuery({
    queryKey: ["my-report-detail", report.id],
    queryFn: () => api.expenses.getReport(report.id),
    enabled: expanded,
  });

  const receipts = fullReport?.receipts ?? report.receipts ?? [];

  return (
    <div className={isNeedsChanges ? "ring-1 ring-amber-200 rounded-lg my-1 mx-2 overflow-hidden" : ""}>
      {/* NEEDS_CHANGES banner */}
      {isNeedsChanges && report.decisionComment && (
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5 flex items-start gap-2">
          <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-amber-700">Finanzas solicita correcciones:</p>
            <p className="text-xs text-amber-600 mt-0.5">&ldquo;{report.decisionComment}&rdquo;</p>
            <p className="text-[10px] text-amber-500 mt-1">Haz clic en cada ticket para editar los campos, luego reenvía el reporte.</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
        <button onClick={() => setExpanded(!expanded)} className="p-1 rounded hover:bg-gray-100">
          <ChevronRight size={16} className={`text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </button>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-gray-800">{report.title}</p>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${st.color}`}>{st.label}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
            <span>{report.periodStart} — {report.periodEnd}</span>
            {report.totalAmount != null && <span className="font-semibold text-gray-700">${report.totalAmount.toFixed(2)} {report.currency}</span>}
            <span>{report.receiptCount ?? receipts.length} tickets</span>
          </div>
          {!isNeedsChanges && report.decisionComment && (
            <p className="text-xs text-amber-600 mt-1 bg-amber-50 px-2 py-1 rounded inline-block">
              Finanzas: &ldquo;{report.decisionComment}&rdquo;
            </p>
          )}
        </div>
        {canSubmit && (
          <button
            onClick={() => {
              onSubmit();
              // Invalidate detail cache after submit
              setTimeout(() => queryClient.invalidateQueries({ queryKey: ["my-report-detail", report.id] }), 500);
            }}
            disabled={submitting}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 transition-colors shrink-0 ${
              isNeedsChanges
                ? "bg-amber-500 text-white hover:bg-amber-600"
                : "bg-seekop-600 text-white hover:bg-seekop-700"
            }`}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {isNeedsChanges ? "Reenviar corregido" : "Enviar a Finanzas"}
          </button>
        )}
      </div>

      {/* Expanded receipt list */}
      {expanded && (
        <div className="bg-gray-50 border-t border-gray-100 px-5 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-500">
              Tickets incluidos ({receipts.length}):
              {isNeedsChanges && <span className="text-amber-600 ml-1">— Haz clic para editar</span>}
            </p>
          </div>
          {receipts.length === 0 ? (
            <p className="text-xs text-gray-400 py-3 text-center">Cargando tickets...</p>
          ) : (
            <div className="space-y-1.5">
              {receipts.map((rc) => {
                const isManual = rc.fileContentType === "application/manual";
                return (
                  <div
                    key={rc.id}
                    onClick={() => onViewReceipt(rc)}
                    className={`flex items-center gap-3 bg-white px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                      isNeedsChanges
                        ? "border-amber-200 hover:border-amber-400 hover:bg-amber-50/30"
                        : "border-gray-100 hover:border-seekop-200 hover:bg-seekop-50/30"
                    }`}
                  >
                    <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                      {isManual ? (
                        <PenLine size={14} className="text-emerald-500" />
                      ) : rc.fileContentType.startsWith("image/") ? (
                        <img src={getAuthFileUrl(rc.fileUrl)} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <FileText size={14} className="text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 truncate">{rc.vendorName || rc.fileName}</p>
                      <div className="flex gap-2 text-[11px] text-gray-400">
                        {rc.totalAmount != null && <span className="font-medium text-gray-600">${rc.totalAmount.toFixed(2)}</span>}
                        {rc.category && <span>{CATEGORY_LABELS[rc.category] ?? rc.category}</span>}
                        {rc.receiptDate && <span>{rc.receiptDate}</span>}
                      </div>
                    </div>
                    {isNeedsChanges ? (
                      <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded font-medium border border-amber-200">Editar</span>
                    ) : (
                      <Eye size={13} className="text-gray-300" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   CREATE REPORT FORM
   ================================================================ */
function CreateReportForm({ unassignedReceipts, onCancel, onCreated }: {
  unassignedReceipts: ExpenseReceipt[]; onCancel: () => void; onCreated: () => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const toggleReceipt = (id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const selectAll = () => {
    setSelectedIds(selectedIds.size === unassignedReceipts.length ? new Set() : new Set(unassignedReceipts.map((r) => r.id)));
  };

  const selectedTotal = unassignedReceipts.filter((r) => selectedIds.has(r.id)).reduce((sum, r) => sum + (r.totalAmount ?? 0), 0);

  const handleCreate = async () => {
    if (!title.trim() || !periodStart || !periodEnd || selectedIds.size === 0) {
      toast("error", "Completa todos los campos y selecciona al menos un ticket.");
      return;
    }
    setCreating(true);
    try {
      await api.expenses.createReport({ title: title.trim(), periodStart, periodEnd, receiptIds: Array.from(selectedIds) });
      toast("success", "Reporte creado exitosamente.");
      onCreated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al crear reporte.";
      toast("error", msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-seekop-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-seekop-100 flex items-center justify-center">
          <Plus size={16} className="text-seekop-600" />
        </div>
        <h3 className="text-sm font-semibold text-gray-800">Crear Nuevo Reporte de Gastos</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Título del reporte</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Viáticos Marzo 2026"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-seekop-500 focus:border-transparent" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Fecha inicio</label>
          <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-seekop-500 focus:border-transparent" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Fecha fin</label>
          <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-seekop-500 focus:border-transparent" />
        </div>
      </div>

      {/* Ticket selection */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-gray-500">
            Seleccionar tickets ({selectedIds.size} de {unassignedReceipts.length})
          </label>
          <button onClick={selectAll} className="text-xs text-seekop-600 hover:underline font-medium">
            {selectedIds.size === unassignedReceipts.length ? "Deseleccionar todos" : "Seleccionar todos"}
          </button>
        </div>
        <div className="max-h-52 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-50">
          {unassignedReceipts.length === 0 ? (
            <p className="p-4 text-xs text-gray-400 text-center">No hay tickets sin asignar. Sube tickets primero en la pestaña &ldquo;Mis Tickets&rdquo;.</p>
          ) : (
            unassignedReceipts.map((r) => (
              <label key={r.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-seekop-50/40 cursor-pointer transition-colors">
                <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleReceipt(r.id)}
                  className="w-4 h-4 rounded border-gray-300 text-seekop-600 focus:ring-seekop-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{r.vendorName || r.fileName}</p>
                  <div className="flex gap-2 text-xs text-gray-400">
                    {r.totalAmount != null && <span className="font-medium text-gray-600">${r.totalAmount.toFixed(2)}</span>}
                    {r.category && <span>{CATEGORY_LABELS[r.category] ?? r.category}</span>}
                    {r.receiptDate && <span>{r.receiptDate}</span>}
                  </div>
                </div>
              </label>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="text-sm">
          {selectedIds.size > 0 && (
            <span className="font-semibold text-gray-800">Total: <span className="text-seekop-700">${selectedTotal.toFixed(2)} MXN</span></span>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">Cancelar</button>
          <button
            onClick={handleCreate}
            disabled={creating || !title.trim() || !periodStart || !periodEnd || selectedIds.size === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-seekop-600 text-white rounded-lg text-sm font-medium hover:bg-seekop-700 disabled:opacity-50 transition-colors"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Crear Reporte
          </button>
        </div>
      </div>
    </div>
  );
}
