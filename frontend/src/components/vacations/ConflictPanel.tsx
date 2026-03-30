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
    <div className={`rounded-lg border ${risk.bg} ${risk.border} overflow-hidden`}>
      {/* Header */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{risk.icon}</span>
          <span className={`font-semibold text-sm ${risk.text}`}>{risk.label}</span>
          {analysis.ai_powered && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-medium">
              🤖 IA
            </span>
          )}
          <span className="text-xs text-gray-500 ml-auto">
            Equipo: {analysis.team_size} personas · {analysis.days_requested} días solicitados
          </span>
        </div>

        {/* Summary */}
        <p className={`text-sm ${risk.text}`}>{analysis.summary}</p>
      </div>

      {/* AI Recommendation */}
      {ai && ai.recommendation && (
        <div className="mx-4 mb-3 p-3 bg-white/80 rounded-lg border border-indigo-200 space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">🤖</span>
            <span className="text-xs font-semibold text-indigo-700">Recomendación de IA</span>
          </div>
          <p className="text-sm text-gray-800 leading-relaxed">{ai.recommendation}</p>

          {ai.key_concerns.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-red-600">⚡ Preocupaciones:</p>
              <ul className="space-y-0.5">
                {ai.key_concerns.map((c, i) => (
                  <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                    <span className="text-red-400 mt-0.5 shrink-0">•</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ai.suggested_actions.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-emerald-600">✅ Acciones sugeridas:</p>
              <ul className="space-y-0.5">
                {ai.suggested_actions.map((a, i) => (
                  <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                    <span className="text-emerald-400 mt-0.5 shrink-0">•</span>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="px-4 pb-4 space-y-3">
        {/* Overlapping colleagues */}
        {analysis.overlapping_requests.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-600">Compañeros de vacaciones en el mismo periodo:</p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.overlapping_requests.map((r, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/70 rounded-full text-xs text-gray-700 border border-gray-200"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                  {r.employee_name} ({r.days}d)
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Daily coverage chart */}
        {analysis.daily_analysis.length > 0 && analysis.daily_analysis.length <= 15 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-600">Cobertura diaria del equipo:</p>
            <div className="space-y-1">
              {analysis.daily_analysis.map((d) => {
                const barColor = d.exceeds_policy
                  ? "bg-red-400"
                  : d.coverage_pct < 50
                  ? "bg-orange-400"
                  : d.coverage_pct < 70
                  ? "bg-yellow-400"
                  : "bg-green-400";
                return (
                  <div key={d.date} className="flex items-center gap-2 text-xs">
                    <span className="w-20 text-gray-500 shrink-0">{d.date_label}</span>
                    <div className="flex-1 h-3 bg-white/50 rounded-full overflow-hidden border border-gray-200">
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${Math.max(5, d.coverage_pct)}%` }}
                      />
                    </div>
                    <span className={`w-10 text-right font-medium ${d.exceeds_policy ? "text-red-600" : "text-gray-600"}`}>
                      {d.coverage_pct}%
                    </span>
                    {d.off_names.length > 0 && (
                      <span className="text-gray-400" title={d.off_names.join(", ")}>
                        ({d.off_names.length} fuera)
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Worst day highlight */}
        {analysis.worst_day && analysis.daily_analysis.length > 15 && (
          <div className="text-xs text-gray-600">
            <span className="font-medium">Día más comprometido:</span>{" "}
            {analysis.worst_day.date_label} — cobertura {analysis.worst_day.coverage_pct}%
            {analysis.worst_day.off_names.length > 0 && (
              <span> ({analysis.worst_day.off_names.join(", ")} fuera)</span>
            )}
          </div>
        )}

        {/* AI powered badge */}
        {!analysis.ai_powered && (
          <p className="text-[10px] text-gray-400 italic">
            Análisis algorítmico — activa OpenAI para recomendaciones inteligentes
          </p>
        )}
      </div>
    </div>
  );
}
