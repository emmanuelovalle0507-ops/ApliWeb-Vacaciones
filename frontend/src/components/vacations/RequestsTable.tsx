"use client";

import React from "react";
import { Calendar, Eye, Pencil, XCircle, CheckCircle, Ban, CalendarDays, Inbox } from "lucide-react";
import type { VacationRequest, RequestStatus } from "@/types";
import { STATUS_LABELS } from "@/types";
import { formatDate } from "@/lib/format";

interface RequestsTableProps {
  data: VacationRequest[];
  isLoading?: boolean;
  showEmployee?: boolean;
  showActions?: boolean;
  readOnly?: boolean;
  onApprove?: (req: VacationRequest) => void;
  onReject?: (req: VacationRequest) => void;
  onCancel?: (req: VacationRequest) => void;
  onEdit?: (req: VacationRequest) => void;
  onView?: (req: VacationRequest) => void;
  onExportICS?: (req: VacationRequest) => void;
  emptyMessage?: string;
}

const STATUS_CONFIG: Record<RequestStatus, { dot: string; bg: string; text: string; border: string }> = {
  PENDING: { dot: "bg-amber-400", bg: "bg-amber-50", text: "text-amber-700", border: "border-l-amber-400" },
  APPROVED: { dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-l-emerald-500" },
  REJECTED: { dot: "bg-red-400", bg: "bg-red-50", text: "text-red-700", border: "border-l-red-400" },
  CANCELED: { dot: "bg-slate-300", bg: "bg-slate-50", text: "text-slate-500", border: "border-l-slate-300" },
};

function StatusPill({ status }: { status: RequestStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}

function ActionBtn({ icon, label, onClick, variant = "default" }: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "success" | "danger";
}) {
  const base = "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150";
  const styles = {
    default: "text-slate-600 hover:text-seekop-700 hover:bg-seekop-50 border border-transparent hover:border-seekop-200",
    success: "text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200",
    danger: "text-red-600 bg-red-50 hover:bg-red-100 border border-red-200",
  };
  return (
    <button onClick={onClick} className={`${base} ${styles[variant]}`} title={label}>
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

export default function RequestsTable({
  data,
  isLoading,
  showEmployee = false,
  showActions = false,
  readOnly = false,
  onApprove,
  onReject,
  onCancel,
  onEdit,
  onView,
  onExportICS,
  emptyMessage = "No hay solicitudes.",
}: RequestsTableProps) {

  const renderActions = (row: VacationRequest) => {
    const today = new Date().toISOString().slice(0, 10);
    const isFuture = row.startDate > today;

    if (readOnly) {
      return (
        <div className="flex items-center gap-1">
          {onView && (
            <ActionBtn icon={<Eye size={14} />} label="Ver detalle" onClick={() => onView(row)} />
          )}
          {onExportICS && row.status === "APPROVED" && (
            <ActionBtn icon={<CalendarDays size={14} />} label="Calendario" onClick={() => onExportICS(row)} />
          )}
          {!onView && !onExportICS && <span className="text-xs text-slate-300">—</span>}
        </div>
      );
    }

    if (row.status === "PENDING") {
      return (
        <div className="flex items-center gap-1">
          {onApprove && (
            <ActionBtn icon={<CheckCircle size={14} />} label="Aprobar" onClick={() => onApprove(row)} variant="success" />
          )}
          {onReject && (
            <ActionBtn icon={<Ban size={14} />} label="Rechazar" onClick={() => onReject(row)} variant="danger" />
          )}
          {onEdit && (
            <ActionBtn icon={<Pencil size={14} />} label="Editar" onClick={() => onEdit(row)} />
          )}
          {onCancel && (
            <ActionBtn icon={<XCircle size={14} />} label="Cancelar" onClick={() => onCancel(row)} />
          )}
          {onView && (
            <ActionBtn icon={<Eye size={14} />} label="Ver" onClick={() => onView(row)} />
          )}
        </div>
      );
    }

    if (row.status === "APPROVED") {
      return (
        <div className="flex items-center gap-1">
          {onView && (
            <ActionBtn icon={<Eye size={14} />} label="Ver detalle" onClick={() => onView(row)} />
          )}
          {onExportICS && (
            <ActionBtn icon={<CalendarDays size={14} />} label="Calendario" onClick={() => onExportICS(row)} />
          )}
          {isFuture && onCancel && (
            <ActionBtn icon={<XCircle size={14} />} label="Cancelar" onClick={() => onCancel(row)} />
          )}
        </div>
      );
    }

    return onView ? (
      <ActionBtn icon={<Eye size={14} />} label="Ver detalle" onClick={() => onView(row)} />
    ) : (
      <span className="text-xs text-slate-300">—</span>
    );
  };

  if (isLoading) {
    return (
      <>
        {/* Mobile loading skeleton */}
        <div className="block sm:hidden space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden border-l-[3px] border-l-slate-200">
              <div className="p-3.5 space-y-2.5">
                <div className="h-3.5 bg-slate-100 rounded-md animate-pulse w-2/5" />
                <div className="h-3 bg-slate-50 rounded-md animate-pulse w-1/3" />
                <div className="flex items-center justify-between">
                  <div className="h-3.5 bg-slate-100 rounded-md animate-pulse w-3/5" />
                  <div className="h-6 w-8 bg-slate-100 rounded-lg animate-pulse" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="h-6 w-20 bg-slate-100 rounded-full animate-pulse" />
                  <div className="h-7 w-16 bg-slate-100 rounded-lg animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop loading skeleton */}
        <div className="hidden sm:block rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="w-1 h-10 rounded-full bg-slate-100 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-slate-100 rounded-md animate-pulse w-3/5" />
                  <div className="h-3 bg-slate-50 rounded-md animate-pulse w-2/5" />
                </div>
                <div className="h-6 w-16 bg-slate-100 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <Inbox size={24} className="text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-400">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile card view */}
      <div className="block sm:hidden space-y-2">
        {data.map((row, idx) => {
          const cfg = STATUS_CONFIG[row.status];
          return (
            <div
              key={idx}
              className={`rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden border-l-[3px] ${cfg.border}`}
            >
              <div className="p-3.5 space-y-2">
                {showEmployee && (
                  <div>
                    <p className="text-sm font-semibold text-slate-800 leading-tight">{row.employeeName}</p>
                    <p className="text-xs text-slate-400">{row.employeeArea}</p>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar size={13} className="text-slate-300 shrink-0" />
                    <span className="text-xs text-slate-700 font-medium">
                      {formatDate(row.startDate)}
                      <span className="text-slate-300 mx-1">→</span>
                      {formatDate(row.endDate)}
                    </span>
                  </div>
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-50 text-xs font-bold text-slate-600 border border-slate-100 shrink-0">
                    {row.requestedBusinessDays}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <StatusPill status={row.status} />
                  {showActions && (
                    <div className="flex items-center gap-1">
                      {renderActions(row)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table view */}
      <div className="hidden sm:block rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gradient-to-r from-slate-50 to-slate-50/50 border-b border-slate-200/80">
                {showEmployee && (
                  <>
                    <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Empleado</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Área</th>
                  </>
                )}
                <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Periodo</th>
                <th className="px-5 py-3.5 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Días</th>
                <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Estado</th>
                <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Creada</th>
                {showActions && (
                  <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((row, idx) => {
                const cfg = STATUS_CONFIG[row.status];
                return (
                  <tr
                    key={idx}
                    className={`border-l-[3px] ${cfg.border} hover:bg-slate-50/70 transition-colors group`}
                  >
                    {showEmployee && (
                      <>
                        <td className="px-5 py-3.5">
                          <span className="text-sm font-medium text-slate-800">{row.employeeName}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-sm text-slate-500">{row.employeeArea}</span>
                        </td>
                      </>
                    )}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-slate-300 shrink-0" />
                        <div className="text-sm">
                          <span className="font-medium text-slate-700">{formatDate(row.startDate)}</span>
                          <span className="text-slate-300 mx-1.5">→</span>
                          <span className="font-medium text-slate-700">{formatDate(row.endDate)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-50 text-sm font-bold text-slate-600 border border-slate-100">
                        {row.requestedBusinessDays}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill status={row.status} />
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="text-xs text-slate-400">{formatDate(row.createdAt)}</span>
                    </td>
                    {showActions && (
                      <td className="px-5 py-3.5 text-right">
                        {renderActions(row)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
