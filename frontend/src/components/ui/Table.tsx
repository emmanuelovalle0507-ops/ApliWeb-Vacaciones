"use client";

import React from "react";
import { Inbox, AlertTriangle } from "lucide-react";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  errorMessage?: string;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export default function Table<T>({
  columns,
  data,
  emptyMessage = "No hay datos disponibles.",
  errorMessage,
  isLoading = false,
  isError = false,
  onRetry,
}: TableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200/80">
        <thead className="bg-slate-50/80">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider ${col.className ?? ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <tr key={`skeleton-${i}`}>
                {columns.map((col) => (
                  <td key={col.key} className="px-6 py-4">
                    <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
                  </td>
                ))}
              </tr>
            ))
          ) : isError ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-10 text-center">
                <div className="flex flex-col items-center gap-2">
                  <AlertTriangle size={24} className="text-red-400" />
                  <p className="text-sm text-red-600 font-medium">
                    {errorMessage || "Error al cargar los datos."}
                  </p>
                  {onRetry && (
                    <button
                      type="button"
                      onClick={onRetry}
                      className="text-xs font-medium text-red-500 hover:text-red-700 underline transition-colors"
                    >
                      Reintentar
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-10 text-center">
                <div className="flex flex-col items-center gap-2">
                  <Inbox size={24} className="text-gray-300" />
                  <p className="text-sm text-gray-400">{emptyMessage}</p>
                </div>
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr key={idx} className="hover:bg-seekop-50/60 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className={`px-6 py-4 whitespace-nowrap text-sm text-gray-700 ${col.className ?? ""}`}>
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
