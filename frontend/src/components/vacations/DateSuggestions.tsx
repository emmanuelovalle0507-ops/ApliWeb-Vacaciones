"use client";

import React, { useMemo, useState } from "react";
import type {
  BalanceInfo,
  DateSuggestion,
  DateSuggestionsResponse,
  PolicyInfo,
} from "@/types";
import { api } from "@/api/client";
import Button from "@/components/ui/Button";
import { isHoliday } from "@/lib/holidays";
import {
  Sparkles,
  CalendarRange,
  Users,
  CalendarClock,
  ChevronDown,
  Info,
  Wand2,
  Search,
  TrendingUp,
} from "lucide-react";

function fmt(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function weekdayInitial(d: Date): string {
  return ["D", "L", "M", "M", "J", "V", "S"][d.getDay()];
}

type SortKey = "score" | "soonest" | "coverage" | "rest";

interface DateSuggestionsProps {
  onSelectDates?: (start: string, end: string) => void;
}

export default function DateSuggestions({ onSelectDates }: DateSuggestionsProps) {
  const [days, setDays] = useState(5);
  const [daysInput, setDaysInput] = useState("5");
  const [flexibleDays, setFlexibleDays] = useState(0);
  const [preferBridges, setPreferBridges] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("score");

  const [response, setResponse] = useState<DateSuggestionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [searched, setSearched] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const handleSearch = async () => {
    setLoading(true);
    setError(undefined);
    setResponse(null);
    setSearched(true);
    setExpanded(null);
    try {
      const result = await api.conflictAnalysis.suggestDates({
        desiredDays: days,
        searchMonths: 3,
        preferBridges,
        flexibleDays,
      });
      setResponse(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const suggestions = response?.suggestions ?? [];
  const policyInfo = response?.policy_info;
  const balanceInfo = response?.balance_info;
  const aiPowered = response?.ai_powered ?? false;

  const sorted = useMemo(() => {
    const arr = [...suggestions];
    switch (sortBy) {
      case "soonest":
        return arr.sort((a, b) => a.notice_days - b.notice_days);
      case "coverage":
        return arr.sort((a, b) => b.min_coverage_pct - a.min_coverage_pct);
      case "rest":
        return arr.sort((a, b) => (b.real_rest_days ?? b.days) - (a.real_rest_days ?? a.days));
      case "score":
      default:
        return arr.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    }
  }, [suggestions, sortBy]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="relative p-5 border-b border-slate-100 bg-gradient-to-br from-seekop-500 to-seekop-600 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-base font-semibold">Fechas óptimas para tus vacaciones</h3>
              <p className="text-xs text-white/80 mt-0.5">
                {aiPowered
                  ? "Análisis con IA basado en la disponibilidad real de tu equipo"
                  : "Basado en la disponibilidad real de tu equipo y días festivos"}
              </p>
            </div>
          </div>
          {aiPowered && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-white/15 rounded-full text-[10px] font-semibold backdrop-blur-sm shrink-0">
              <Wand2 size={11} /> IA activa
            </span>
          )}
        </div>
      </div>

      {/* Info bar: policy + balance */}
      {(policyInfo || balanceInfo) && (
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] text-slate-700">
          {policyInfo && (
            <>
              <InfoPill icon={<CalendarClock size={12} />} label="Anticipación mín." value={`${policyInfo.min_notice_days} días`} />
              <InfoPill icon={<Users size={12} />} label="Máx. fuera/día" value={String(policyInfo.max_people_off_per_day)} />
              <InfoPill icon={<Users size={12} />} label="Equipo" value={`${policyInfo.team_size} personas`} />
              <InfoPill icon={<CalendarRange size={12} />} label="Desde" value={fmt(policyInfo.earliest_allowed_date)} />
            </>
          )}
          {balanceInfo && (
            <InfoPill
              icon={<TrendingUp size={12} />}
              label="Disponibles"
              value={`${balanceInfo.available_days} días`}
              highlight
            />
          )}
        </div>
      )}

      {/* Search controls */}
      <div className="p-5 border-b border-slate-100 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              ¿Cuántos días hábiles quieres?
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={daysInput}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d{1,2}$/.test(v)) {
                  setDaysInput(v);
                  const n = parseInt(v, 10);
                  if (!isNaN(n) && n >= 1 && n <= 30) setDays(n);
                }
              }}
              onBlur={() => {
                const n = parseInt(daysInput, 10);
                const clamped = isNaN(n) ? 1 : Math.max(1, Math.min(30, n));
                setDays(clamped);
                setDaysInput(String(clamped));
              }}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-seekop-400 focus:border-seekop-500"
            />
          </div>
          <Button onClick={handleSearch} loading={loading} variant="primary" className="shrink-0 min-w-[140px]">
            {loading ? "Analizando..." : (
              <span className="inline-flex items-center gap-1.5">
                <Search size={14} /> Buscar fechas
              </span>
            )}
          </Button>
        </div>

        {/* Preferences */}
        <div className="space-y-3 pt-1">
          {/* Bridge preference */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider w-full sm:w-auto sm:mr-1">
              Preferencias
            </span>
            <ChipToggle
              active={preferBridges}
              onClick={() => setPreferBridges((v) => !v)}
              label="Priorizar fechas con puente"
            />
          </div>

          {/* Flexibility */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  Flexibilidad de duración
                </span>
                <span
                  className="text-slate-400 hover:text-slate-600 cursor-help"
                  title="Si marcas flexibilidad, también te mostraremos opciones con 1 o 2 días menos o más que los que pediste. Así tienes más alternativas."
                >
                  <Info size={11} />
                </span>
              </div>
            </div>

            <div className="inline-flex items-center gap-0.5 bg-slate-100 rounded-full p-0.5">
              <button
                onClick={() => setFlexibleDays(0)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                  flexibleDays === 0 ? "bg-white text-seekop-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Exactamente {days} {days === 1 ? "día" : "días"}
              </button>
              <button
                onClick={() => setFlexibleDays(1)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                  flexibleDays === 1 ? "bg-white text-seekop-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Entre {Math.max(1, days - 1)} y {days + 1} días
              </button>
              <button
                onClick={() => setFlexibleDays(2)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                  flexibleDays === 2 ? "bg-white text-seekop-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Entre {Math.max(1, days - 2)} y {days + 2} días
              </button>
            </div>
            <p className="text-[10.5px] text-slate-500 mt-1.5 leading-snug">
              {flexibleDays === 0
                ? "Solo buscaremos opciones de exactamente los días que pediste."
                : `También te mostraremos rangos de ${Math.max(1, days - flexibleDays)} a ${days + flexibleDays} días hábiles. Útil si puedes ajustar la duración para aprovechar mejores fechas.`}
            </p>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="p-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <Info size={16} className="text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {!searched && !loading && !error && (
          <div className="text-center py-8">
            <div className="w-14 h-14 mx-auto bg-seekop-50 rounded-full flex items-center justify-center mb-3">
              <Sparkles size={22} className="text-seekop-500" />
            </div>
            <p className="text-sm text-slate-600 font-medium">
              Elige los días que quieres y pulsa "Buscar fechas"
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Te sugeriremos las mejores opciones considerando puentes, festivos y tu equipo.
            </p>
          </div>
        )}

        {searched && !loading && !error && sorted.length === 0 && (
          <div className="text-center py-8">
            <div className="w-14 h-14 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-3">
              <CalendarRange size={22} className="text-slate-400" />
            </div>
            <p className="text-sm text-slate-600 font-medium">Sin opciones disponibles</p>
            <p className="text-xs text-slate-400 mt-1">
              Prueba con menos días o activa la flexibilidad (±1 o ±2).
            </p>
          </div>
        )}

        {sorted.length > 0 && (
          <>
            {/* Sort controls */}
            <div className="flex items-center gap-2 mb-4 text-[11px]">
              <span className="font-medium text-slate-500 uppercase tracking-wider">Ordenar</span>
              <div className="inline-flex items-center gap-0.5 bg-slate-100 rounded-full p-0.5">
                <SortChip active={sortBy === "score"} onClick={() => setSortBy("score")} label="Mejor puntuación" />
                <SortChip active={sortBy === "soonest"} onClick={() => setSortBy("soonest")} label="Más próximas" />
                <SortChip active={sortBy === "coverage"} onClick={() => setSortBy("coverage")} label="Cobertura" />
                <SortChip active={sortBy === "rest"} onClick={() => setSortBy("rest")} label="Descanso real" />
              </div>
            </div>

            {/* Grid of cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {sorted.map((s, i) => (
                <SuggestionCard
                  key={`${s.start_date}-${s.days}`}
                  suggestion={s}
                  isTop={i === 0 && sortBy === "score"}
                  isExpanded={expanded === i}
                  onToggle={() => setExpanded(expanded === i ? null : i)}
                  onSelect={onSelectDates ? () => onSelectDates(s.start_date, s.end_date) : undefined}
                />
              ))}
            </div>
          </>
        )}

        {loading && (
          <div className="py-8 text-center">
            <div className="inline-block w-8 h-8 border-2 border-seekop-200 border-t-seekop-500 rounded-full animate-spin" />
            <p className="text-sm text-slate-500 mt-3">
              Analizando disponibilidad del equipo...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────

function InfoPill({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${highlight ? "text-seekop-700 font-semibold" : ""}`}>
      <span className={highlight ? "text-seekop-500" : "text-slate-400"}>{icon}</span>
      <span className="text-slate-500">{label}:</span>
      <strong className={highlight ? "text-seekop-700" : "text-slate-800"}>{value}</strong>
    </span>
  );
}

function ChipToggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-colors ${
        active
          ? "bg-seekop-500 text-white border-seekop-500"
          : "bg-white text-slate-600 border-slate-300 hover:border-seekop-300 hover:text-seekop-600"
      }`}
    >
      {active ? "✓ " : ""}{label}
    </button>
  );
}

function SortChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
        active ? "bg-white text-seekop-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {label}
    </button>
  );
}

interface SuggestionCardProps {
  suggestion: DateSuggestion;
  isTop: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect?: () => void;
}

function SuggestionCard({ suggestion: s, isTop, isExpanded, onToggle, onSelect }: SuggestionCardProps) {
  const score = s.score ?? Math.round(s.avg_coverage_pct ?? 0);
  const realRestDays = s.real_rest_days ?? s.days;
  const bridgeBefore = s.bridge_before ?? 0;
  const bridgeAfter = s.bridge_after ?? 0;
  const holidaysInRange = s.holidays_in_range ?? [];
  const colleaguesOff = s.colleagues_off ?? [];
  const aiPros = s.ai_pros ?? [];
  const aiCons = s.ai_cons ?? [];

  const scoreColor = score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-600" : "text-orange-600";
  const scoreBg = score >= 80 ? "stroke-emerald-500" : score >= 60 ? "stroke-amber-500" : "stroke-orange-500";

  const baseBorder = s.exceeds_policy
    ? "border-red-300 bg-red-50/30"
    : isTop
      ? "border-seekop-300 bg-seekop-50/30 ring-2 ring-seekop-500/20"
      : "border-slate-200 bg-white";

  return (
    <div className={`relative rounded-xl border transition-all hover:shadow-md ${baseBorder}`}>
      {isTop && (
        <span className="absolute -top-2 left-4 px-2 py-0.5 bg-seekop-500 text-white text-[10px] font-bold rounded-full uppercase tracking-wider shadow">
          Recomendado
        </span>
      )}

      <div className="p-4">
        {/* Top row: dates + score donut */}
        <div className="flex items-start gap-3">
          <ScoreDonut score={score} colorClass={scoreBg} textClass={scoreColor} />

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800">
              {fmt(s.start_date)} <span className="text-slate-400">→</span> {fmt(s.end_date)}
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[11px] text-slate-500">
              <span><strong className="text-slate-700">{s.days}</strong> días hábiles</span>
              <span className="text-slate-300">•</span>
              <span>
                <strong className="text-seekop-600">{realRestDays}</strong> días de descanso real
              </span>
            </div>

            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {s.has_bridge && (
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[10px] font-medium border border-blue-100">
                  🌉 Puente {bridgeBefore > 0 && bridgeAfter > 0 ? "doble" : bridgeBefore > 0 ? "inicio" : "cierre"}
                </span>
              )}
              {holidaysInRange.length > 0 && (
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-seekop-accent/10 text-emerald-700 rounded-md text-[10px] font-medium border border-seekop-accent/20">
                  🎉 {holidaysInRange.length} festivo{holidaysInRange.length > 1 ? "s" : ""}
                </span>
              )}
              {s.exceeds_policy && (
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-red-100 text-red-700 rounded-md text-[10px] font-medium border border-red-200">
                  ⚠️ Excede política
                </span>
              )}
              {colleaguesOff.length === 0 && !s.exceeds_policy && (
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-[10px] font-medium border border-emerald-100">
                  ✓ Equipo completo
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Mini-calendar strip */}
        <div className="mt-3">
          <CalendarStrip
            startDate={s.start_date}
            endDate={s.end_date}
            holidaysInRange={holidaysInRange}
          />
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          <button
            onClick={onToggle}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-seekop-600 transition-colors"
          >
            {isExpanded ? "Ocultar detalle" : "Ver detalle"}
            <ChevronDown size={13} className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} />
          </button>

          {onSelect && !s.exceeds_policy && (
            <button
              onClick={onSelect}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-seekop-500 hover:bg-seekop-600 rounded-lg transition-colors shadow-sm"
            >
              Usar estas fechas
            </button>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {s.ai_explanation && (
            <div className="p-3 bg-seekop-50/60 rounded-lg border border-seekop-100">
              <p className="text-[11px] font-semibold text-seekop-700 mb-1 flex items-center gap-1">
                <Wand2 size={11} /> Análisis IA
              </p>
              <p className="text-xs text-slate-700 leading-relaxed">{s.ai_explanation}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {aiPros.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider">Pros</p>
                {aiPros.map((p, pi) => (
                  <div key={pi} className="flex items-start gap-1.5 text-[11px] text-slate-700">
                    <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            )}
            {aiCons.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider">Contras</p>
                {aiCons.map((c, ci) => (
                  <div key={ci} className="flex items-start gap-1.5 text-[11px] text-slate-700">
                    <span className="text-amber-500 mt-0.5 shrink-0">!</span>
                    <span>{c}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {colleaguesOff.length > 0 && (
            <div className="text-[11px] text-slate-600">
              <p className="font-semibold text-slate-700 mb-1">Compañeros fuera en esas fechas:</p>
              <div className="flex flex-wrap gap-1">
                {colleaguesOff.map((name) => (
                  <span key={name} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px]">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>
              Cobertura: <strong className="text-slate-700">{s.min_coverage_pct}%</strong> – <strong className="text-slate-700">{s.max_coverage_pct}%</strong>
            </span>
            <span>
              Anticipación: <strong className="text-slate-700">{s.notice_days} días</strong>
            </span>
            {bridgeBefore > 0 && (
              <span>
                Descanso previo: <strong className="text-slate-700">{bridgeBefore} día{bridgeBefore > 1 ? "s" : ""}</strong>
              </span>
            )}
            {bridgeAfter > 0 && (
              <span>
                Descanso posterior: <strong className="text-slate-700">{bridgeAfter} día{bridgeAfter > 1 ? "s" : ""}</strong>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreDonut({ score, colorClass, textClass }: { score: number; colorClass: string; textClass: string }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-12 h-12 shrink-0">
      <svg viewBox="0 0 44 44" className="w-12 h-12 -rotate-90">
        <circle cx="22" cy="22" r={radius} fill="none" className="stroke-slate-100" strokeWidth="4" />
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          className={colorClass}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-xs font-bold ${textClass}`}>{score}</span>
      </div>
    </div>
  );
}

/** Compact visual strip of the vacation range, marking weekends and holidays. */
function CalendarStrip({
  startDate,
  endDate,
  holidaysInRange,
}: {
  startDate: string;
  endDate: string;
  holidaysInRange: string[];
}) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  // Show from (start - 2) to (end + 2) to visualize the surrounding context
  const stripStart = new Date(start);
  stripStart.setDate(stripStart.getDate() - 2);
  const stripEnd = new Date(end);
  stripEnd.setDate(stripEnd.getDate() + 2);

  const days: Date[] = [];
  const cursor = new Date(stripStart);
  while (cursor <= stripEnd) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  const holidaySet = new Set(holidaysInRange);

  return (
    <div className="flex items-center gap-0.5">
      {days.map((d, i) => {
        const iso = toISO(d);
        const inRange = d >= start && d <= end;
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        const holiday = holidaySet.has(iso) || isHoliday(iso);

        let style = "bg-slate-100 text-slate-400"; // outside
        if (inRange) {
          if (holiday) style = "bg-seekop-accent/30 text-emerald-800 font-semibold";
          else if (isWeekend) style = "bg-slate-300 text-slate-600";
          else style = "bg-seekop-500 text-white font-semibold";
        } else if (holiday) {
          style = "bg-seekop-accent/20 text-emerald-700";
        } else if (isWeekend) {
          style = "bg-slate-200 text-slate-500";
        }

        return (
          <div
            key={i}
            className={`flex-1 h-10 rounded-md flex flex-col items-center justify-center text-[9px] leading-tight transition-colors ${style}`}
            title={`${iso}${holiday ? " (festivo)" : isWeekend ? " (fin de semana)" : ""}`}
          >
            <span className="opacity-70">{weekdayInitial(d)}</span>
            <span className="text-[10px]">{d.getDate()}</span>
          </div>
        );
      })}
    </div>
  );
}
