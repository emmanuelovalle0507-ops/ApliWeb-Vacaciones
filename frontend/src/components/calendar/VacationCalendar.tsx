"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Calendar as CalendarIcon, Users, CheckCircle2, Clock4, X } from "lucide-react";
import api from "@/api/client";
import type { CalendarEvent } from "@/types";
import { getMexicanHolidays } from "@/lib/holidays";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const STATUS_STYLES = {
  APPROVED: {
    bar: "bg-emerald-100 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
    avatar: "bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-700",
    card: "bg-emerald-50 border-emerald-200",
    label: "Aprobada",
  },
  PENDING: {
    bar: "bg-amber-100 text-amber-800 border-amber-200",
    dot: "bg-amber-400",
    avatar: "bg-amber-400",
    badge: "bg-amber-100 text-amber-700",
    card: "bg-amber-50 border-amber-200",
    label: "Pendiente",
  },
};

const HOLIDAY_NAMES: Record<string, string> = {};
function getHolidayName(dateStr: string): string | undefined {
  const year = parseInt(dateStr.substring(0, 4), 10);
  const key = `${year}`;
  if (!HOLIDAY_NAMES[key + "-loaded"]) {
    const holidays = getMexicanHolidays(year);
    const names = ["Año Nuevo", "Día de la Constitución", "Natalicio de Benito Juárez", "Día del Trabajo", "Día de la Independencia", "Revolución Mexicana", "Navidad"];
    holidays.forEach((h, i) => { HOLIDAY_NAMES[h] = names[i]; });
    HOLIDAY_NAMES[key + "-loaded"] = "1";
  }
  return HOLIDAY_NAMES[dateStr];
}

function formatMonthLabel(year: number, month: number): string {
  const d = new Date(year, month - 1, 1);
  const label = d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  if (start === end) return s.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  if (s.getMonth() === e.getMonth())
    return `${s.getDate()} – ${e.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}`;
  return `${s.toLocaleDateString("es-MX", { day: "numeric", month: "short" })} – ${e.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}`;
}

interface DayCellData {
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
  dateStr: string;
  events: CalendarEvent[];
}

function buildGrid(year: number, month: number, events: CalendarEvent[]): DayCellData[][] {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const holidaySet = new Set(getMexicanHolidays(year));

  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const cells: DayCellData[] = [];

  const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i;
    const prevM = month - 1 <= 0 ? 12 : month - 1;
    const prevY = month - 1 <= 0 ? year - 1 : year;
    const dateStr = `${prevY}-${String(prevM).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, isCurrentMonth: false, isToday: false, isWeekend: cells.length % 7 >= 5, isHoliday: false, dateStr, events: [] });
  }

  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayOfWeek = cells.length % 7;
    const dayEvents = events.filter((e) => e.startDate <= dateStr && e.endDate >= dateStr);
    cells.push({
      day: d, isCurrentMonth: true, isToday: dateStr === todayStr,
      isWeekend: dayOfWeek >= 5, isHoliday: holidaySet.has(dateStr),
      holidayName: getHolidayName(dateStr), dateStr, events: dayEvents,
    });
  }

  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const nextM = month + 1 > 12 ? 1 : month + 1;
      const nextY = month + 1 > 12 ? year + 1 : year;
      const dateStr = `${nextY}-${String(nextM).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ day: d, isCurrentMonth: false, isToday: false, isWeekend: cells.length % 7 >= 5, isHoliday: false, dateStr, events: [] });
    }
  }

  const weeks: DayCellData[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

interface VacationCalendarProps {
  teamId?: string;
  title?: string;
}

export default function VacationCalendar({ teamId, title = "Calendario de Vacaciones" }: VacationCalendarProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<DayCellData | null>(null);

  const monthKey = getMonthKey(year, month);
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["calendar", monthKey, teamId],
    queryFn: () => api.calendar.getEvents(monthKey, teamId),
  });

  const weeks = useMemo(() => buildGrid(year, month, events), [year, month, events]);

  const goPrev = () => {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); } else setMonth((m) => m - 1);
    setSelectedDay(null);
  };
  const goNext = () => {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); } else setMonth((m) => m + 1);
    setSelectedDay(null);
  };
  const goToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); setSelectedDay(null); };

  const approvedCount = events.filter((e) => e.status === "APPROVED").length;
  const pendingCount = events.filter((e) => e.status === "PENDING").length;
  const uniqueEmployees = new Set(events.map((e) => e.employeeId)).size;

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">

      {/* ── Header ── */}
      <div className="bg-gradient-to-br from-slate-800 via-slate-800 to-slate-700 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          {/* Title + stats */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 shrink-0 rounded-xl bg-white/10 flex items-center justify-center text-white">
              <CalendarIcon size={17} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white leading-tight truncate">{title}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {approvedCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full">
                    <CheckCircle2 size={9} /> {approvedCount} aprobada{approvedCount !== 1 ? "s" : ""}
                  </span>
                )}
                {pendingCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full">
                    <Clock4 size={9} /> {pendingCount} pendiente{pendingCount !== 1 ? "s" : ""}
                  </span>
                )}
                {uniqueEmployees > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-white/10 text-slate-300 px-1.5 py-0.5 rounded-full">
                    <Users size={9} /> {uniqueEmployees} persona{uniqueEmployees !== 1 ? "s" : ""}
                  </span>
                )}
                {events.length === 0 && !isLoading && (
                  <span className="text-[10px] text-slate-400">Sin eventos este mes</span>
                )}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1 shrink-0">
            {!isCurrentMonth && (
              <button
                onClick={goToday}
                className="hidden sm:block px-2.5 py-1.5 text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all border border-white/10 hover:border-white/20 mr-1"
              >
                Hoy
              </button>
            )}
            <button onClick={goPrev} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white">
              <ChevronLeft size={18} />
            </button>
            <span className="min-w-[130px] text-center text-sm font-bold text-white tracking-tight">
              {formatMonthLabel(year, month)}
            </span>
            <button onClick={goNext} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded-b-2xl">
            <div className="flex flex-col items-center gap-2">
              <Loader2 size={22} className="text-seekop-500 animate-spin" />
              <span className="text-xs text-slate-400">Cargando...</span>
            </div>
          </div>
        )}

        {/* Weekday headers */}
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
          {WEEKDAYS.map((wd, i) => (
            <div
              key={wd}
              className={`text-center text-[11px] font-bold uppercase tracking-widest py-2.5 ${
                i >= 5 ? "text-slate-400" : "text-slate-500"
              }`}
            >
              {wd}
            </div>
          ))}
        </div>

        {/* Weeks */}
        <div className="divide-y divide-slate-100">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 divide-x divide-slate-100">
              {week.map((cell) => {
                const hasEvents = cell.events.length > 0;
                const isSelected = selectedDay?.dateStr === cell.dateStr;
                const isClickable = (hasEvents || cell.isHoliday) && cell.isCurrentMonth;

                return (
                  <button
                    key={cell.dateStr}
                    onClick={() => isClickable ? setSelectedDay(isSelected ? null : cell) : undefined}
                    title={cell.isHoliday && cell.holidayName ? cell.holidayName : undefined}
                    className={[
                      "relative min-h-[60px] sm:min-h-[90px] p-1.5 sm:p-2 text-left flex flex-col transition-colors",
                      !cell.isCurrentMonth ? "opacity-25" : "",
                      cell.isWeekend && cell.isCurrentMonth ? "bg-slate-50/70" : "",
                      cell.isHoliday && cell.isCurrentMonth ? "bg-red-50/70" : "",
                      isSelected ? "bg-seekop-50 ring-2 ring-inset ring-seekop-300" : "",
                      !isSelected && cell.isToday ? "ring-2 ring-inset ring-seekop-400" : "",
                      isClickable && !isSelected ? "hover:bg-slate-50 cursor-pointer" : "cursor-default",
                    ].filter(Boolean).join(" ")}
                  >
                    {/* Day number */}
                    <span
                      className={[
                        "inline-flex items-center justify-center w-6 h-6 text-xs rounded-full font-semibold mb-0.5 self-end",
                        cell.isToday
                          ? "bg-seekop-600 text-white shadow-sm shadow-seekop-300"
                          : cell.isHoliday && cell.isCurrentMonth
                          ? "text-red-500"
                          : cell.isCurrentMonth
                          ? isSelected ? "text-seekop-700 font-bold" : "text-slate-700"
                          : "text-slate-300",
                      ].filter(Boolean).join(" ")}
                    >
                      {cell.day}
                    </span>

                    {/* Holiday label */}
                    {cell.isHoliday && cell.isCurrentMonth && (
                      <div className="hidden sm:block px-1.5 py-0.5 rounded text-[9px] leading-tight truncate bg-red-100 text-red-500 font-semibold mb-0.5 border border-red-100">
                        {cell.holidayName ?? "Feriado"}
                      </div>
                    )}
                    {cell.isHoliday && cell.isCurrentMonth && (
                      <div className="sm:hidden w-1.5 h-1.5 rounded-full bg-red-400 mb-0.5" />
                    )}

                    {/* Events */}
                    {cell.isCurrentMonth && cell.events.length > 0 && (
                      <div className="flex flex-col gap-0.5 mt-auto w-full overflow-hidden">
                        {cell.events.slice(0, 2).map((ev) => {
                          const st = STATUS_STYLES[ev.status] ?? STATUS_STYLES.PENDING;
                          const initials = getInitials(ev.employeeName);
                          const firstName = ev.employeeName.split(" ")[0];
                          return (
                            <div
                              key={ev.requestId}
                              className={`flex items-center gap-1 px-1 sm:px-1.5 py-0.5 rounded border text-[10px] leading-tight w-full ${st.bar}`}
                              title={ev.employeeName}
                            >
                              <span className={`shrink-0 w-3.5 h-3.5 rounded-full ${st.avatar} text-white text-[8px] font-bold flex items-center justify-center`}>
                                {initials[0]}
                              </span>
                              <span className="truncate hidden sm:block font-medium">{firstName}</span>
                            </div>
                          );
                        })}
                        {cell.events.length > 2 && (
                          <span className="text-[9px] text-slate-400 font-medium pl-0.5">
                            +{cell.events.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Selected day panel ── */}
      {selectedDay && (
        <div className="border-t border-slate-100 bg-gradient-to-b from-slate-50 to-white px-4 sm:px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-seekop-100 flex items-center justify-center">
                <CalendarIcon size={13} className="text-seekop-600" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 capitalize">
                {new Date(selectedDay.dateStr + "T12:00:00").toLocaleDateString("es-MX", {
                  weekday: "long", day: "numeric", month: "long",
                })}
              </h4>
              {selectedDay.isHoliday && selectedDay.holidayName && (
                <span className="text-[10px] font-semibold bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full border border-red-100">
                  {selectedDay.holidayName}
                </span>
              )}
            </div>
            <button
              onClick={() => setSelectedDay(null)}
              className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {selectedDay.events.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {selectedDay.events.map((ev) => {
                const st = STATUS_STYLES[ev.status] ?? STATUS_STYLES.PENDING;
                const initials = getInitials(ev.employeeName);
                return (
                  <div
                    key={ev.requestId}
                    className={`flex items-center gap-3 p-3 rounded-xl border bg-white shadow-sm ${st.card}`}
                  >
                    <div className={`w-9 h-9 rounded-full ${st.avatar} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{ev.employeeName}</p>
                      <p className="text-xs text-slate-400">{formatDateRange(ev.startDate, ev.endDate)}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${st.badge}`}>
                      {st.label}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              {selectedDay.isHoliday ? "Día festivo, sin vacaciones programadas." : "Sin vacaciones este día."}
            </p>
          )}
        </div>
      )}

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-5 py-3 border-t border-slate-100 bg-white">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
          <span className="text-[11px] font-medium text-slate-400">Aprobada</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
          <span className="text-[11px] font-medium text-slate-400">Pendiente</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-300" />
          <span className="text-[11px] font-medium text-slate-400">Feriado</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="w-4 h-4 rounded-full bg-seekop-600 flex items-center justify-center text-white text-[8px] font-bold">
            {now.getDate()}
          </span>
          <span className="text-[11px] font-medium text-slate-400">Hoy</span>
        </div>
      </div>
    </div>
  );
}
