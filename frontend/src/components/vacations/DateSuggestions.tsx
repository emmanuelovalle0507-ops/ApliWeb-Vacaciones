"use client";

import React, { useState } from "react";
import type { DateSuggestion } from "@/types";
import { api } from "@/api/client";
import Button from "@/components/ui/Button";

function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

interface DateSuggestionsProps {
  onSelectDates?: (start: string, end: string) => void;
}

export default function DateSuggestions({ onSelectDates }: DateSuggestionsProps) {
  const [days, setDays] = useState(5);
  const [suggestions, setSuggestions] = useState<DateSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    setError(undefined);
    setSuggestions([]);
    setSearched(true);
    try {
      const result = await api.conflictAnalysis.suggestDates(days, 3);
      setSuggestions(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const riskColor = (pct: number, exceeds: boolean) => {
    if (exceeds) return "text-red-600 bg-red-50";
    if (pct >= 70) return "text-green-700 bg-green-50";
    if (pct >= 50) return "text-yellow-700 bg-yellow-50";
    return "text-orange-700 bg-orange-50";
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <span className="text-lg">💡</span>
          Sugerencia de Fechas Óptimas
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          Te recomendamos las mejores fechas según la disponibilidad de tu equipo
        </p>
      </div>

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
          Buscar fechas
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
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all hover:shadow-sm ${
                  i === 0 ? "border-indigo-200 bg-indigo-50/30" : "border-gray-200 bg-gray-50/50"
                }`}
              >
                {/* Rank */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  i === 0 ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"
                }`}>
                  {i + 1}
                </div>

                {/* Dates */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">
                    {formatDateLabel(s.start_date)} → {formatDateLabel(s.end_date)}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500">{s.days} días hábiles</span>
                    {s.has_bridge && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium">
                        🌉 Puente
                      </span>
                    )}
                  </div>
                </div>

                {/* Coverage */}
                <div className={`px-2 py-1 rounded-md text-xs font-medium ${riskColor(s.min_coverage_pct, s.exceeds_policy)}`}>
                  {s.exceeds_policy ? "⚠️ Excede" : `${s.min_coverage_pct}% cobertura`}
                </div>

                {/* Select button */}
                {onSelectDates && !s.exceeds_policy && (
                  <button
                    onClick={() => onSelectDates(s.start_date, s.end_date)}
                    className="px-3 py-1.5 text-xs font-medium text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-300 rounded-lg transition-colors"
                  >
                    Usar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
