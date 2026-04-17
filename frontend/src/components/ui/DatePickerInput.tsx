"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
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
  value?: string;
  onChange?: (dateStr: string) => void;
  minDate?: string;
}

function parseISO(s: string): Date | undefined {
  if (!s) return undefined;
  const d = parse(s, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
}

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
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const [mounted, setMounted] = useState(false);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const selected = parseISO(value ?? "");
  const min = parseISO(minDate ?? "");

  useEffect(() => { setMounted(true); }, []);

  // Compute popup position relative to the button each time it opens
  useEffect(() => {
    if (!open || !buttonRef.current) return;

    const updatePosition = () => {
      const rect = buttonRef.current!.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const popupHeight = 320; // approx calendar height

      const spaceBelow = viewportHeight - rect.bottom;
      const openUpward = spaceBelow < popupHeight && rect.top > popupHeight;

      setPopupStyle({
        position: "fixed",
        left: rect.left,
        top: openUpward ? rect.top - popupHeight - 4 : rect.bottom + 4,
        minWidth: rect.width,
        zIndex: 99999,
      });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        popupRef.current?.contains(target)
      ) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const currentYear = new Date().getFullYear();
  const holidayYears = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
  const holidayDates: Date[] = holidayYears.flatMap((y) =>
    getMexicanHolidays(y).map((s) => parse(s, "yyyy-MM-dd", new Date()))
  );

  const disabledMatchers: Array<Date | { dayOfWeek: number[] } | { before: Date }> = [
    { dayOfWeek: [0, 6] },
    ...holidayDates,
  ];
  if (min) disabledMatchers.push({ before: min });

  const handleSelect = (day: Date | undefined) => {
    if (day) onChange?.(toISO(day));
    setOpen(false);
  };

  const inputId = label?.toLowerCase().replace(/\s/g, "-");

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <button
        ref={buttonRef}
        id={inputId}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full px-4 py-2.5 border rounded-lg text-sm outline-none transition-colors text-left flex items-center justify-between focus:ring-2 focus:ring-seekop-400 focus:border-seekop-500 ${
          error ? "border-red-300 focus:ring-red-500 focus:border-red-500" : "border-gray-300"
        } ${selected ? "text-gray-900" : "text-gray-400"}`}
      >
        <span>
          {selected ? format(selected, "d 'de' MMMM, yyyy", { locale: es }) : "Seleccionar fecha"}
        </span>
        <CalendarDays size={18} className="text-gray-400" />
      </button>

      {open && mounted && createPortal(
        <div
          ref={popupRef}
          style={popupStyle}
          className="bg-white border border-gray-200 rounded-lg shadow-xl"
        >
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            disabled={disabledMatchers}
            locale={es}
            defaultMonth={selected || min || new Date()}
          />
        </div>,
        document.body
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
