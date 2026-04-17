"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle2, AlertTriangle, XCircle, MinusCircle, RefreshCw, Clock } from "lucide-react";
import RoleGuard from "@/components/layout/RoleGuard";
import api from "@/api/client";
import Button from "@/components/ui/Button";

const STATUS_STYLES = {
  healthy:  { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50",  ring: "ring-emerald-100", label: "Saludable" },
  warning:  { icon: AlertTriangle, color: "text-amber-600",  bg: "bg-amber-50",    ring: "ring-amber-100",   label: "Advertencia" },
  down:     { icon: XCircle,       color: "text-red-600",    bg: "bg-red-50",      ring: "ring-red-100",     label: "Caído" },
  disabled: { icon: MinusCircle,   color: "text-slate-400",  bg: "bg-slate-50",    ring: "ring-slate-100",   label: "Deshabilitado" },
} as const;

const OVERALL_STYLES = {
  healthy:  { color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200", label: "Sistema saludable" },
  warning:  { color: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-200",   label: "Sistema con advertencias" },
  degraded: { color: "text-red-700",     bg: "bg-red-50",      border: "border-red-200",     label: "Sistema degradado" },
} as const;

export default function AdminHealthPage() {
  const q = useQuery({
    queryKey: ["admin.health"],
    queryFn: () => api.admin.health(),
    refetchInterval: 30000,
  });

  const activityQ = useQuery({
    queryKey: ["admin.activityFeed"],
    queryFn: () => api.admin.activityFeed(15),
    refetchInterval: 30000,
  });

  return (
    <RoleGuard allowed={["ADMIN"]}>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Estado del sistema</h1>
            <p className="text-sm text-gray-500 mt-1">
              Monitoreo en tiempo real de integraciones y servicios
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { q.refetch(); activityQ.refetch(); }}
            disabled={q.isFetching}
          >
            <RefreshCw size={14} className={q.isFetching ? "animate-spin" : ""} />
            Refrescar
          </Button>
        </div>

        {/* Overall status banner */}
        {q.data && (() => {
          const style = OVERALL_STYLES[q.data.overall];
          return (
            <div className={`flex items-center gap-3 p-4 rounded-xl border ${style.bg} ${style.border}`}>
              <Activity size={22} className={style.color} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${style.color}`}>{style.label}</p>
                <p className="text-xs text-slate-600">
                  Entorno: <span className="font-mono">{q.data.env}</span> · Última verificación: {new Date(q.data.checked_at).toLocaleString("es-MX")}
                </p>
              </div>
            </div>
          );
        })()}

        {/* Components grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {q.isLoading && (
            <div className="col-span-full p-6 text-center text-sm text-slate-500">
              Cargando estado...
            </div>
          )}
          {q.data?.components.map((c) => {
            const style = STATUS_STYLES[c.status];
            const Icon = style.icon;
            return (
              <div
                key={c.name}
                className={`flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-white ring-1 ${style.ring}`}
              >
                <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${style.bg} ${style.color} shrink-0`}>
                  <Icon size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-slate-900">{c.name}</h3>
                    <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${style.bg} ${style.color}`}>
                      {style.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 break-words">{c.detail}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Activity feed */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} className="text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-700">Actividad reciente</h3>
          </div>
          {activityQ.isLoading ? (
            <p className="text-sm text-slate-500 py-6 text-center">Cargando actividad...</p>
          ) : (activityQ.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">Sin actividad reciente</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {activityQ.data?.items.map((item) => (
                <li key={item.id} className="py-2 flex items-center gap-3 text-sm">
                  <span className="font-mono text-[10px] text-slate-400 w-32 shrink-0">
                    {new Date(item.created_at).toLocaleString("es-MX", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="text-[11px] uppercase font-bold tracking-wider bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0">
                    {item.action.replace(/_/g, " ")}
                  </span>
                  <span className="text-slate-700 truncate">{item.actor_name ?? "Sistema"}</span>
                  <span className="text-xs text-slate-400 font-mono ml-auto shrink-0">
                    {item.entity_type}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}
