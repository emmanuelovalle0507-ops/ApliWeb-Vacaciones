"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Calendar as CalendarIcon } from "lucide-react";
import api from "@/api/client";
import type { CalendarEvent } from "@/types";
import { getMexicanHolidays } from "@/lib/holidays";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const STATUS_STYLES: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  APPROVED: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500" },
  PENDING: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", dot: "bg-amber-500" },
};

function formatMonthLabel(year: number, month: number): string {
  const d = new Date(year, month - 1, 1);
  const label = d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
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

const HOLIDAY_NAMES: Record<string, string> = {};
function getHolidayName(dateStr: string): string | undefined {
  const year = parseInt(dateStr.substring(0, 4), 10);
  const key = `${year}`;
  if (!HOLIDAY_NAMES[key + "-loaded"]) {
    const holidays = getMexicanHolidays(year);
    const names = [
      "A\u00f1o Nuevo",
      "D\u00eda de la Constituci\u00f3n",
      "Natalicio de Benito Ju\u00e1rez",
      "D\u00eda del Trabajo",
      "D\u00eda de la Independencia",
      "Revoluci\u00f3n Mexicana",
      "Navidad",
    ];
    holidays.forEach((h, i) => { HOLIDAY_NAMES[h] = names[i]; });
    HOLIDAY_NAMES[key + "-loaded"] = "1";
  }
  return HOLIDAY_NAMES[dateStr];
}

function buildGrid(year: number, month: number, events: CalendarEvent[]): DayCellData[][] {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const holidaySet = new Set(getMexicanHolidays(year));

  // Monday=0 based start offset
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const cells: DayCellData[] = [];

  // Previous month padding
  const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i;
    const prevM = month - 1 <= 0 ? 12 : month - 1;
    const prevY = month - 1 <= 0 ? year - 1 : year;
    const dateStr = `${prevY}-${String(prevM).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayOfWeek = cells.length % 7;
    cells.push({
      day: d,
      isCurrentMonth: false,
      isToday: false,
      isWeekend: dayOfWeek >= 5,
      isHoliday: false,
      dateStr,
      events: [],
    });
  }

  // Current month
  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayOfWeek = cells.length % 7;
    const dayEvents = events.filter((e) => e.startDate <= dateStr && e.endDate >= dateStr);
    cells.push({
      day: d,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      isWeekend: dayOfWeek >= 5,
      isHoliday: holidaySet.has(dateStr),
      holidayName: getHolidayName(dateStr),
      dateStr,
      events: dayEvents,
    });
  }

  // Next month padding
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const nextM = month + 1 > 12 ? 1 : month + 1;
      const nextY = month + 1 > 12 ? year + 1 : year;
      const dateStr = `${nextY}-${String(nextM).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayOfWeek = cells.length % 7;
      cells.push({
        day: d,
        isCurrentMonth: false,
        isToday: false,
        isWeekend: dayOfWeek >= 5,
        isHoliday: false,
        dateStr,
        events: [],
      });
    }
  }

  // Split into weeks
  const weeks: DayCellData[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

function EventPill({ event }: { event: CalendarEvent }) {
  const styles = STATUS_STYLES[event.status] ?? STATUS_STYLES.PENDING;
  return (
    <div
      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] leading-tight truncate ${styles.bg} ${styles.text} border ${styles.border}`}
      title={`${event.employeeName} — ${event.status === "APPROVED" ? "Aprobada" : "Pendiente"}`}
    >
      <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${styles.dot}`} />
      <span className="truncate">{event.employeeName.split(" ")[0]}</span>
    </div>
  );
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
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
    setSelectedDay(null);
  };

  const goNext = () => {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
    setSelectedDay(null);
  };

  const goToday = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
    setSelectedDay(null);
  };

  // Stats
  const approvedCount = events.filter((e) => e.status === "APPROVED").length;
  const pendingCount = events.filter((e) => e.status === "PENDING").length;
  const uniqueEmployees = new Set(events.map((e) => e.employeeId)).size;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-seekop-50 text-seekop-600">
            <CalendarIcon size={20} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {approvedCount} aprobadas · {pendingCount} pendientes · {uniqueEmployees} persona{uniqueEmployees !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={goToday}
            className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            Hoy
          </button>
          <button onClick={goPrev} className="p-1.5 hover:bg-gray-100 rounded-md transition-colors text-gray-500">
            <ChevronLeft size={18} />
          </button>
          <span className="min-w-[140px] text-center text-sm font-semibold text-gray-800">
            {formatMonthLabel(year, month)}
          </span>
          <button onClick={goNext} className="p-1.5 hover:bg-gray-100 rounded-md transition-colors text-gray-500">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
            <Loader2 size={24} className="text-seekop-500 animate-spin" />
          </div>
        )}

        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {WEEKDAYS.map((wd, i) => (
            <div
              key={wd}
              className={`text-center text-[11px] font-semibold uppercase tracking-wider py-2 ${
                i >= 5 ? "text-gray-400 bg-gray-50/50" : "text-gray-500"
              }`}
            >
              {wd}
            </div>
          ))}
        </div>

        {/* Weeks */}
        <div className="divide-y divide-gray-50">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 divide-x divide-gray-50">
              {week.map((cell) => {
                const hasEvents = cell.events.length > 0;
                const isSelected = selectedDay?.dateStr === cell.dateStr;
                return (
                  <button
                    key={cell.dateStr}
                    onClick={() => (hasEvents || cell.isHoliday) && cell.isCurrentMonth ? setSelectedDay(isSelected ? null : cell) : undefined}
                    title={cell.isHoliday && cell.holidayName ? cell.holidayName : undefined}
                    className={`relative min-h-[80px] p-1.5 text-left transition-colors ${
                      cell.isCurrentMonth ? "" : "opacity-30"
                    } ${cell.isWeekend ? "bg-gray-50/50" : ""} ${
                      cell.isHoliday && cell.isCurrentMonth ? "bg-red-50/60" : ""
                    } ${
                      cell.isToday ? "ring-2 ring-inset ring-seekop-400" : ""
                    } ${isSelected ? "bg-blue-50" : (hasEvents || cell.isHoliday) && cell.isCurrentMonth ? "hover:bg-gray-50 cursor-pointer" : "cursor-default"}`}
                  >
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 text-xs rounded-full ${
                        cell.isToday
                          ? "bg-seekop-600 text-white font-bold"
                          : cell.isHoliday && cell.isCurrentMonth
                          ? "bg-red-100 text-red-600 font-bold"
                          : cell.isCurrentMonth
                          ? "text-gray-700 font-medium"
                          : "text-gray-300"
                      }`}
                    >
                      {cell.day}
                    </span>
                    {cell.isHoliday && cell.isCurrentMonth && (
                      <div className="mt-0.5 px-1.5 py-0.5 rounded text-[9px] leading-tight truncate bg-red-100 text-red-600 border border-red-200 font-medium">
                        {cell.holidayName ?? "Feriado"}
                      </div>
                    )}
                    {cell.isCurrentMonth && cell.events.length > 0 && (
                      <div className="mt-0.5 space-y-0.5 overflow-hidden max-h-[48px]">
                        {cell.events.slice(0, 3).map((ev) => (
                          <EventPill key={ev.requestId} event={ev} />
                        ))}
                        {cell.events.length > 3 && (
                          <span className="text-[10px] text-gray-400 pl-1">+{cell.events.length - 3} más</span>
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

      {/* Day detail panel */}
      {selectedDay && selectedDay.events.length > 0 && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-800">
              {new Date(selectedDay.dateStr + "T12:00:00").toLocaleDateString("es-MX", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </h4>
            <button
              onClick={() => setSelectedDay(null)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cerrar
            </button>
          </div>
          <div className="space-y-2">
            {selectedDay.events.map((ev) => {
              const styles = STATUS_STYLES[ev.status] ?? STATUS_STYLES.PENDING;
              return (
                <div
                  key={ev.requestId}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg border ${styles.bg} ${styles.border}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${styles.dot}`} />
                    <span className={`text-sm font-medium ${styles.text}`}>{ev.employeeName}</span>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs ${styles.text}`}>
                      {ev.startDate} → {ev.endDate}
                    </span>
                    <span className={`ml-2 text-[10px] font-semibold uppercase ${styles.text}`}>
                      {ev.status === "APPROVED" ? "Aprobada" : "Pendiente"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 px-5 py-3 border-t border-gray-100 bg-gray-50/30">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-[11px] text-gray-500">Aprobada</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="text-[11px] text-gray-500">Pendiente</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="text-[11px] text-gray-500">Feriado</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="w-4 h-4 rounded ring-2 ring-seekop-400" />
          <span className="text-[11px] text-gray-500">Hoy</span>
        </div>
      </div>
    </div>
  );
}
