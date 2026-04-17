"use client";

import React from "react";
import { Calendar, Clock, Gift, ArrowRightLeft } from "lucide-react";
import type { VacationBalance } from "@/types";

interface BalanceCardProps {
  balance: VacationBalance | null;
  isLoading?: boolean;
}

export default function BalanceCard({ balance, isLoading }: BalanceCardProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 animate-pulse animate-card-enter stagger-${i + 1}`}>
            <div className="h-3 bg-slate-100 rounded-full w-2/3 mb-4" />
            <div className="h-9 bg-slate-100 rounded-lg w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  const available = balance?.availableDays ?? 0;
  const granted = balance?.grantedDays ?? 0;

  const items = [
    {
      label: "Disponibles",
      value: available,
      icon: <Calendar size={20} strokeWidth={1.8} />,
      accent: "from-seekop-500 to-seekop-600",
      iconBg: "bg-seekop-500/10 text-seekop-600",
      highlight: true,
    },
    {
      label: "Usados",
      value: balance?.usedDays ?? 0,
      icon: <Clock size={20} strokeWidth={1.8} />,
      accent: "from-amber-400 to-amber-500",
      iconBg: "bg-amber-50 text-amber-600",
      highlight: false,
    },
    {
      label: "Otorgados",
      value: granted,
      icon: <Gift size={20} strokeWidth={1.8} />,
      accent: "from-emerald-400 to-emerald-500",
      iconBg: "bg-emerald-50 text-emerald-600",
      highlight: false,
    },
    {
      label: "Arrastrados",
      value: balance?.carriedOverDays ?? 0,
      icon: <ArrowRightLeft size={20} strokeWidth={1.8} />,
      accent: "from-blue-400 to-blue-500",
      iconBg: "bg-blue-50 text-blue-600",
      highlight: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`animate-card-enter stagger-${i + 1} relative overflow-hidden bg-white rounded-2xl border shadow-sm group hover:shadow-md transition-shadow duration-300 ${
            item.highlight ? "border-seekop-200/80" : "border-slate-200/60"
          }`}
        >
          <div className={`h-1 bg-gradient-to-r ${item.accent}`} />

          <div className="p-3.5 sm:p-5">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center ${item.iconBg} transition-transform duration-200 group-hover:scale-105`}>
                {item.icon}
              </div>
              <span className="text-[9px] sm:text-[10px] font-semibold text-slate-300 uppercase tracking-widest">
                {balance?.year ?? new Date().getFullYear()}
              </span>
            </div>

            <p className={`text-2xl sm:text-3xl font-bold tracking-tight ${item.highlight ? "text-seekop-600" : "text-slate-800"}`}>
              {item.value}
            </p>
            <p className="text-[10px] sm:text-xs font-medium text-slate-400 mt-0.5 sm:mt-1 uppercase tracking-wide truncate">
              {item.label}
            </p>

          </div>
        </div>
      ))}
    </div>
  );
}
