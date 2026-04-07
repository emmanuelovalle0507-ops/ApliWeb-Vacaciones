"use client";

import React from "react";
import type { ConflictAnalysis, RiskLevel } from "@/types";

const riskConfig: Record<RiskLevel, { bg: string; border: string; icon: string; label: string; text: string }> = {
  LOW: { bg: "bg-green-50", border: "border-green-200", icon: "🟢", label: "Riesgo Bajo", text: "text-green-800" },
  MEDIUM: { bg: "bg-yellow-50", border: "border-yellow-200", icon: "🟡", label: "Riesgo Medio", text: "text-yellow-800" },
  HIGH: { bg: "bg-orange-50", border: "border-orange-200", icon: "🔴", label: "Riesgo Alto", text: "text-orange-800" },
  CRITICAL: { bg: "bg-red-50", border: "border-red-300", icon: "⚠️", label: "Conflicto Crítico", text: "text-red-800" },
};

interface ConflictPanelProps {
  analysis: ConflictAnalysis | null;
  loading: boolean;
  error?: string;
}

export default function ConflictPanel({ analysis, loading, error }: ConflictPanelProps) {
  if (loading) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 animate-pulse space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gray-200 rounded-full" />
          <div className="h-4 bg-gray-200 rounded w-32" />
          <div className="h-3 bg-gray-200 rounded w-20 ml-auto" />
        </div>
        <div className="h-3 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
        <div className="p-3 bg-gray-100 rounded-lg space-y-2">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 bg-gray-200 rounded" />
            <div className="h-3 bg-gray-200 rounded w-40" />
          </div>
          <div className="h-3 bg-gray-200 rounded w-full" />
          <div className="h-3 bg-gray-200 rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-700">No se pudo analizar conflictos: {error}</p>
      </div>
    );
  }

  if (!analysis) return null;

  const risk = riskConfig[analysis.risk_level];
  const ai = analysis.ai_recommendation;

  return (
    <div className="space-y-4">
      {/* Risk level header */}
      <div className={`rounded-xl border ${risk.bg} ${risk.border} p-5`}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">{risk.icon}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`font-bold text-base ${risk.text}`}>{risk.label}</span>
              {analysis.ai_powered && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[11px] font-medium">
                  Análisis IA
                </span>
              )}
            </div>
            <span className="text-xs text-gray-500">
              Equipo de {analysis.team_size} personas · {analysis.days_requested} días solicitados
            </span>
          </div>
        </div>
        <p className={`text-sm leading-relaxed ${risk.text}`}>{analysis.summary}</p>
      </div>

      {/* AI Recommendation */}
      {ai && ai.recommendation && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-base">🤖</span>
            <span className="text-sm font-bold text-indigo-800">Recomendación de IA</span>
          </div>
          <p className="text-sm text-gray-800 leading-relaxed">{ai.recommendation}</p>

          {ai.key_concerns.length > 0 && (
            <div className="p-3 bg-red-50 rounded-lg border border-red-100 space-y-1.5">
              <p className="text-xs font-semibold text-red-700">⚡ Preocupaciones</p>
              <ul className="space-y-1">
                {ai.key_concerns.map((c, i) => (
                  <li key={i} className="text-xs text-red-800 flex items-start gap-2">
                    <span className="text-red-400 mt-0.5 shrink-0">•</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ai.suggested_actions.length > 0 && (
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 space-y-1.5">
              <p className="text-xs font-semibold text-emerald-700">✅ Acciones sugeridas</p>
              <ul className="space-y-1">
                {ai.suggested_actions.map((a, i) => (
                  <li key={i} className="text-xs text-emerald-800 flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5 shrink-0">•</span>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Overlapping colleagues */}
      {analysis.overlapping_requests.length > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-5 space-y-2.5">
          <p className="text-sm font-semibold text-orange-800">👥 Compañeros de vacaciones en el mismo periodo</p>
          <div className="flex flex-wrap gap-2">
            {analysis.overlapping_requests.map((r, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white rounded-full text-xs text-gray-700 border border-orange-200 shadow-sm"
              >
                <span className="w-2 h-2 rounded-full bg-orange-400" />
                {r.employee_name} ({r.days} días)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Jira: No tickets — positive message */}
      {analysis.jira && analysis.jira.success && analysis.jira.total === 0 && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
          <span className="text-2xl">✅</span>
          <div>
            <p className="text-sm font-bold text-emerald-800">Sin tareas pendientes en Jira</p>
            <p className="text-xs text-emerald-600 mt-0.5">El empleado no tiene tickets asignados durante este periodo. No hay riesgo de trabajo bloqueado.</p>
          </div>
        </div>
      )}

      {/* Jira Tickets */}
      {analysis.jira && analysis.jira.success && analysis.jira.total > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base">🎫</span>
            <p className="text-sm font-bold text-blue-800">
              Tickets de Jira ({analysis.jira.total})
            </p>
            {analysis.jira.high_priority_count > 0 && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[11px] font-semibold">
                {analysis.jira.high_priority_count} alta prioridad
              </span>
            )}
            {analysis.jira.due_during_period > 0 && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[11px] font-semibold">
                {analysis.jira.due_during_period} vencen en periodo
              </span>
            )}
          </div>
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
            {analysis.jira.issues.map((issue) => {
              const prioColor =
                issue.priority_raw === "highest" || issue.priority_raw === "high"
                  ? "bg-red-100 text-red-700 border-red-200"
                  : issue.priority_raw === "medium"
                  ? "bg-amber-100 text-amber-700 border-amber-200"
                  : "bg-green-100 text-green-700 border-green-200";
              return (
                <div
                  key={issue.key}
                  className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-blue-100 text-xs shadow-sm"
                >
                  <span className={`shrink-0 px-1.5 py-0.5 rounded border text-[10px] font-bold ${prioColor}`}>
                    {issue.priority}
                  </span>
                  <a
                    href={issue.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-blue-600 hover:underline shrink-0"
                  >
                    {issue.key}
                  </a>
                  <span className="text-gray-800 truncate flex-1" title={issue.summary}>
                    {issue.summary}
                  </span>
                  <span className="shrink-0 px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">
                    {issue.status}
                  </span>
                  {issue.due_date && (
                    <span className="shrink-0 text-gray-500 text-[10px]">
                      📅 {issue.due_date}
                    </span>
                  )}
                  {issue.sprint && (
                    <span className="shrink-0 text-gray-400 text-[10px]" title={issue.sprint}>
                      🏃 {issue.sprint}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Jira AI concerns inside the Jira card */}
          {ai && ai.jira_concerns && ai.jira_concerns.length > 0 && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 space-y-1.5">
              <p className="text-xs font-semibold text-blue-700">🎫 Observaciones IA sobre carga en Jira</p>
              <ul className="space-y-1">
                {ai.jira_concerns.map((c, i) => (
                  <li key={i} className="text-xs text-blue-800 flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5 shrink-0">•</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Jira not configured or error */}
      {analysis.jira && !analysis.jira.success && analysis.jira.configured && (
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
          <p className="text-xs text-gray-500 italic">
            No se pudieron obtener tickets de Jira: {analysis.jira.error}
          </p>
        </div>
      )}

      {/* AI powered badge */}
      {!analysis.ai_powered && (
        <p className="text-[11px] text-gray-400 italic text-center">
          Análisis algorítmico — activa OpenAI para recomendaciones inteligentes
        </p>
      )}
    </div>
  );
}
