"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Plug, ShieldCheck, Settings as SettingsIcon, Info, Lock } from "lucide-react";
import RoleGuard from "@/components/layout/RoleGuard";
import api from "@/api/client";
import { getMexicanHolidays } from "@/lib/holidays";
import { USER_ROLES, ROLE_LABELS } from "@/types";

const HOLIDAY_NAMES: Record<string, string> = {
  "01-01": "Año Nuevo",
  "05-01": "Día del Trabajo",
  "09-16": "Día de la Independencia",
  "12-25": "Navidad",
  // Floating ones (nth weekday) — labeled in list
};

function labelForHoliday(iso: string, index: number, total: number): string {
  const mmdd = iso.slice(5);
  if (HOLIDAY_NAMES[mmdd]) return HOLIDAY_NAMES[mmdd];
  if (index === 1) return "Día de la Constitución";
  if (index === 2) return "Natalicio de Benito Juárez";
  if (index === total - 2) return "Revolución Mexicana";
  return "Día festivo oficial";
}

export default function AdminSettingsPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const healthQ = useQuery({
    queryKey: ["admin.health"],
    queryFn: () => api.admin.health(),
    staleTime: 60000,
  });

  const statsQ = useQuery({
    queryKey: ["admin.kpi.stats"],
    queryFn: () => api.admin.stats(),
    staleTime: 60000,
  });

  const holidays = getMexicanHolidays(year);
  const integrations = healthQ.data?.components.filter(c =>
    ["OpenAI (LLM)", "Jira", "Email (SMTP)"].includes(c.name)
  ) ?? [];

  return (
    <RoleGuard allowed={["ADMIN"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración del sistema</h1>
          <p className="text-sm text-gray-500 mt-1">
            Parámetros globales, integraciones y referencia operativa
          </p>
        </div>

        {/* System info card */}
        <SectionCard icon={Info} title="Información del sistema" subtitle="Estado general actual">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <InfoTile label="Entorno" value={healthQ.data?.env ?? "—"} />
            <InfoTile label="Año fiscal" value={String(currentYear)} />
            <InfoTile label="Usuarios totales" value={statsQ.data?.total_users ?? "—"} />
            <InfoTile label="Nuevas contrataciones (mes)" value={statsQ.data?.new_hires_month ?? "—"} />
          </div>
        </SectionCard>

        {/* Integrations */}
        <SectionCard icon={Plug} title="Integraciones" subtitle="Conexiones con servicios externos" readOnly>
          <div className="space-y-2">
            {healthQ.isLoading && <p className="text-sm text-slate-500">Cargando estado...</p>}
            {integrations.map((c) => (
              <IntegrationRow key={c.name} name={c.name} status={c.status} detail={c.detail} />
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">
            La configuración de integraciones se gestiona mediante variables de entorno del servidor.
          </p>
        </SectionCard>

        {/* Holidays */}
        <SectionCard icon={Calendar} title="Días festivos oficiales" subtitle="Excluidos del cálculo de días hábiles" readOnly>
          <div className="flex items-center gap-2 mb-3">
            <label className="text-xs text-slate-500">Año:</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="text-sm border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-seekop-200"
            >
              {Array.from({ length: 5 }, (_, i) => currentYear - 1 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <ul className="divide-y divide-slate-100">
            {holidays.map((iso, idx) => (
              <li key={iso} className="py-2 flex items-center justify-between text-sm">
                <span className="font-mono text-slate-500 w-28 shrink-0">
                  {new Date(iso + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                </span>
                <span className="text-slate-700 flex-1">{labelForHoliday(iso, idx, holidays.length)}</span>
                <span className="text-xs text-slate-400 font-mono">{iso}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-400 mt-3">
            Lista fija por ley federal mexicana. Para añadir festivos locales, contactar al equipo de desarrollo.
          </p>
        </SectionCard>

        {/* Roles */}
        <SectionCard icon={ShieldCheck} title="Roles y permisos" subtitle="Roles disponibles en el sistema" readOnly>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {USER_ROLES.map((r) => (
              <div
                key={r}
                className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
              >
                <span className="w-2 h-2 rounded-full bg-seekop-500" />
                <span className="text-sm font-medium text-slate-700">{ROLE_LABELS[r]}</span>
                <span className="ml-auto text-[10px] font-mono text-slate-400">{r}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Defaults */}
        <SectionCard icon={SettingsIcon} title="Valores por defecto" subtitle="Defaults del sistema (informativo)" readOnly>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <InfoTile label="Días anuales por defecto" value="12 días (LFT)" />
            <InfoTile label="Notice mínimo por defecto" value="3 días" />
            <InfoTile label="Máximo simultáneo por equipo" value="Configurable por equipo" />
            <InfoTile label="Política de rollover" value="Manual (desde dashboard)" />
          </div>
        </SectionCard>
      </div>
    </RoleGuard>
  );
}

// ── Reusable subcomponents ─────────────────────────────────────────
function SectionCard({
  icon: Icon,
  title,
  subtitle,
  readOnly,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  readOnly?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-seekop-50 text-seekop-600 shrink-0">
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        {readOnly && (
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-400 font-medium">
            <Lock size={11} />
            Solo lectura
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
      <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">{label}</p>
      <p className="text-sm font-semibold text-slate-900 mt-0.5 truncate">{value}</p>
    </div>
  );
}

function IntegrationRow({ name, status, detail }: { name: string; status: string; detail: string }) {
  const styleMap: Record<string, { dot: string; label: string; color: string }> = {
    healthy:  { dot: "bg-emerald-500", label: "Activo",        color: "text-emerald-700" },
    warning:  { dot: "bg-amber-500",   label: "Advertencia",   color: "text-amber-700" },
    down:     { dot: "bg-red-500",     label: "Caído",         color: "text-red-700" },
    disabled: { dot: "bg-slate-300",   label: "Deshabilitado", color: "text-slate-500" },
  };
  const s = styleMap[status] ?? styleMap.disabled;
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
      <span className={`w-2 h-2 rounded-full ${s.dot} shrink-0`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900">{name}</p>
        <p className="text-xs text-slate-500 truncate">{detail}</p>
      </div>
      <span className={`text-[11px] uppercase tracking-wider font-semibold ${s.color} shrink-0`}>
        {s.label}
      </span>
    </div>
  );
}
