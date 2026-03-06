"use client";

import React, { useState, useRef, useEffect } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import "./datepicker.css";
import { format, parse, isValid } from "date-fns";
import { es } from "date-fns/locale";
import { getMexicanHolidays } from "@/lib/holidays";
import { CalendarDays } from "lucide-react";

interface DatePickerInputProps {
  label?: string;
  error?: string;
  value?: string; // YYYY-MM-DD
  onChange?: (dateStr: string) => void;
  minDate?: string; // YYYY-MM-DD
}

/** Parse YYYY-MM-DD to Date object */
function parseISO(s: string): Date | undefined {
  if (!s) return undefined;
  const d = parse(s, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
}

/** Format Date to YYYY-MM-DD */
function toISO(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export default function DatePickerInput({
  label,
  error,
  value,
  onChange,
  minDate,
}: DatePickerInputProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = parseISO(value ?? "");
  const min = parseISO(minDate ?? "");

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Build disabled matchers: weekends, holidays, and before minDate
  const currentYear = new Date().getFullYear();
  const holidayYears = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
  const holidayDates: Date[] = holidayYears.flatMap((y) =>
    getMexicanHolidays(y).map((s) => parse(s, "yyyy-MM-dd", new Date()))
  );

  const disabledMatchers: Array<Date | { dayOfWeek: number[] } | { before: Date }> = [
    { dayOfWeek: [0, 6] }, // weekends
    ...holidayDates,
  ];
  if (min) {
    disabledMatchers.push({ before: min });
  }

  const handleSelect = (day: Date | undefined) => {
    if (day) {
      onChange?.(toISO(day));
    }
    setOpen(false);
  };

  const inputId = label?.toLowerCase().replace(/\s/g, "-");

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          id={inputId}
          type="button"
          onClick={() => setOpen(!open)}
          className={`w-full px-4 py-2.5 border rounded-lg text-sm outline-none transition-colors text-left flex items-center justify-between focus:ring-2 focus:ring-seekop-400 focus:border-seekop-500 ${
            error ? "border-red-300 focus:ring-red-500 focus:border-red-500" : "border-gray-300"
          } ${selected ? "text-gray-900" : "text-gray-400"}`}
        >
          <span>
            {selected ? format(selected, "d 'de' MMMM, yyyy", { locale: es }) : "Seleccionar fecha"}
          </span>
          <CalendarDays size={18} className="text-gray-400" />
        </button>

        {open && (
          <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={handleSelect}
              disabled={disabledMatchers}
              locale={es}
              defaultMonth={selected || min || new Date()}
            />
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
