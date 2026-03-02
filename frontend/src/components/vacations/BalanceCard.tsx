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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-2/3 mb-3" />
            <div className="h-8 bg-gray-200 rounded w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  const items = [
    {
      label: "Días Disponibles",
      value: balance?.availableDays ?? 0,
      icon: <Calendar size={22} />,
      color: "text-seekop-600 bg-seekop-50",
    },
    {
      label: "Días Usados",
      value: balance?.usedDays ?? 0,
      icon: <Clock size={22} />,
      color: "text-amber-600 bg-amber-50",
    },
    {
      label: "Días Otorgados",
      value: balance?.grantedDays ?? 0,
      icon: <Gift size={22} />,
      color: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "Días Arrastrados",
      value: balance?.carriedOverDays ?? 0,
      icon: <ArrowRightLeft size={22} />,
      color: "text-blue-600 bg-blue-50",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-start gap-4"
        >
          <div className={`p-2.5 rounded-lg ${item.color}`}>{item.icon}</div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {item.label}
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">{item.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{balance?.year ?? new Date().getFullYear()}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
