"use client";

import React, { useState } from "react";
import type { DateSuggestion, DateSuggestionsResponse, PolicyInfo } from "@/types";
import { api } from "@/api/client";
import Button from "@/components/ui/Button";

function fmt(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

interface DateSuggestionsProps {
  onSelectDates?: (start: string, end: string) => void;
}

export default function DateSuggestions({ onSelectDates }: DateSuggestionsProps) {
  const [days, setDays] = useState(5);
  const [suggestions, setSuggestions] = useState<DateSuggestion[]>([]);
  const [policyInfo, setPolicyInfo] = useState<PolicyInfo | null>(null);
  const [aiPowered, setAiPowered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [searched, setSearched] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const handleSearch = async () => {
    setLoading(true);
    setError(undefined);
    setSuggestions([]);
    setPolicyInfo(null);
    setAiPowered(false);
    setSearched(true);
    setExpanded(null);
    try {
      const result: DateSuggestionsResponse = await api.conflictAnalysis.suggestDates(days, 3);
      setSuggestions(result.suggestions);
      setPolicyInfo(result.policy_info);
      setAiPowered(result.ai_powered);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const coverageColor = (pct: number) => {
    if (pct >= 80) return "text-green-700 bg-green-50 border-green-200";
    if (pct >= 60) return "text-yellow-700 bg-yellow-50 border-yellow-200";
    return "text-orange-700 bg-orange-50 border-orange-200";
  };

  const scoreColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-orange-500";
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <span className="text-lg">💡</span>
            Sugerencia de Fechas Óptimas
          </h3>
          {aiPowered && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[10px] font-semibold">
              🤖 IA
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {aiPowered
            ? "Análisis inteligente basado en la disponibilidad real de tu equipo y políticas"
            : "Te recomendamos las mejores fechas según la disponibilidad de tu equipo"}
        </p>
      </div>

      {/* Policy info banner */}
      {policyInfo && (
        <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-amber-800">
          <span>📋 <strong>Anticipación mín:</strong> {policyInfo.min_notice_days} días</span>
          <span>👥 <strong>Máx. fuera/día:</strong> {policyInfo.max_people_off_per_day}</span>
          <span>🏢 <strong>Equipo:</strong> {policyInfo.team_size} personas</span>
          <span>📅 <strong>Desde:</strong> {fmt(policyInfo.earliest_allowed_date)}</span>
        </div>
      )}

      {/* Search controls */}
      <div className="p-4 flex items-end gap-3 border-b border-gray-100">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            ¿Cuántos días hábiles quieres?
          </label>
          <input
            type="number"
            min={1}
            max={30}
            value={days}
            onChange={(e) => setDays(Math.max(1, Math.min(30, Number(e.target.value))))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <Button onClick={handleSearch} loading={loading} variant="primary" className="shrink-0">
          {loading ? "Analizando..." : "Buscar fechas"}
        </Button>
      </div>

      {/* Results */}
      <div className="p-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {searched && !loading && !error && suggestions.length === 0 && (
          <div className="text-center py-6">
            <span className="text-3xl">📅</span>
            <p className="text-sm text-gray-500 mt-2">
              No se encontraron fechas disponibles. Intenta con menos días o un periodo más amplio.
            </p>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="space-y-3">
            {suggestions.map((s, i) => {
              const isExpanded = expanded === i;
              return (
                <div
                  key={i}
                  className={`rounded-lg border transition-all ${
                    i === 0
                      ? "border-indigo-200 bg-indigo-50/30 shadow-sm"
                      : s.exceeds_policy
                        ? "border-red-200 bg-red-50/20"
                        : "border-gray-200 bg-gray-50/50"
                  }`}
                >
                  {/* Main row */}
                  <div
                    className="flex items-center gap-3 p-3 cursor-pointer"
                    onClick={() => setExpanded(isExpanded ? null : i)}
                  >
                    {/* Rank badge */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      i === 0 ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {i + 1}
                    </div>

                    {/* Dates + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">
                        {fmt(s.start_date)} → {fmt(s.end_date)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">{s.days} días hábiles</span>
                        {s.has_bridge && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium">
                            🌉 Puente
                          </span>
                        )}
                        {s.colleagues_off?.length > 0 && (
                          <span className="text-[10px] text-gray-400">
                            {s.colleagues_off.length} compañero(s) fuera
                          </span>
                        )}
                      </div>
                    </div>

                    {/* AI Score or Coverage */}
                    {s.ai_score ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${scoreColor(s.ai_score)}`} style={{ width: `${s.ai_score}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-gray-600">{s.ai_score}</span>
                      </div>
                    ) : (
                      <div className={`px-2 py-1 rounded-md text-xs font-medium border ${
                        s.exceeds_policy ? "text-red-600 bg-red-50 border-red-200" : coverageColor(s.min_coverage_pct)
                      }`}>
                        {s.exceeds_policy ? "⚠️ Excede" : `${s.avg_coverage_pct}%`}
                      </div>
                    )}

                    {/* Select button */}
                    {onSelectDates && !s.exceeds_policy && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onSelectDates(s.start_date, s.end_date); }}
                        className="px-3 py-1.5 text-xs font-medium text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-300 rounded-lg transition-colors shrink-0"
                      >
                        Usar
                      </button>
                    )}

                    {/* Expand arrow */}
                    <svg className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-0 border-t border-gray-100 space-y-2">
                      {/* AI explanation */}
                      {s.ai_explanation && (
                        <div className="p-2.5 bg-purple-50 rounded-md border border-purple-100">
                          <p className="text-xs font-semibold text-purple-700 mb-1 flex items-center gap-1">
                            🤖 Análisis IA
                          </p>
                          <p className="text-xs text-purple-900">{s.ai_explanation}</p>
                        </div>
                      )}

                      {/* Pros & Cons */}
                      <div className="grid grid-cols-2 gap-2">
                        {s.ai_pros && s.ai_pros.length > 0 && (
                          <div className="space-y-1">
                            {s.ai_pros.map((p, pi) => (
                              <div key={pi} className="flex items-start gap-1 text-[11px] text-green-700">
                                <span className="mt-0.5 shrink-0">✅</span>
                                <span>{p}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {s.ai_cons && s.ai_cons.length > 0 && (
                          <div className="space-y-1">
                            {s.ai_cons.map((c, ci) => (
                              <div key={ci} className="flex items-start gap-1 text-[11px] text-red-700">
                                <span className="mt-0.5 shrink-0">⚠️</span>
                                <span>{c}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Colleagues off */}
                      {s.colleagues_off?.length > 0 && (
                        <div className="text-[11px] text-gray-500">
                          <span className="font-medium">Compañeros fuera en esas fechas:</span>{" "}
                          {s.colleagues_off.join(", ")}
                        </div>
                      )}

                      {/* Coverage range */}
                      <div className="flex gap-3 text-[11px] text-gray-500">
                        <span>Cobertura: <strong>{s.min_coverage_pct}%</strong> – <strong>{s.max_coverage_pct}%</strong></span>
                        <span>Anticipación: <strong>{s.notice_days} días</strong></span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
