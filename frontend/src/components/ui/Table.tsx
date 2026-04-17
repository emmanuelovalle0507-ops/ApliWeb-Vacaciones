"use client";

import React from "react";
import { Inbox, AlertTriangle } from "lucide-react";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface SelectionConfig<T> {
  selectedIds: string[];
  getRowId: (row: T) => string;
  onToggle: (id: string) => void;
  onToggleAll: (allIds: string[]) => void;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  errorMessage?: string;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  selection?: SelectionConfig<T>;
}

export default function Table<T>({
  columns,
  data,
  emptyMessage = "No hay datos disponibles.",
  errorMessage,
  isLoading = false,
  isError = false,
  onRetry,
  selection,
}: TableProps<T>) {
  const allIds = selection ? data.map(selection.getRowId) : [];
  const selectedSet = new Set(selection?.selectedIds ?? []);
  const allSelected = selection && allIds.length > 0 && allIds.every((id) => selectedSet.has(id));
  const someSelected = selection && !allSelected && allIds.some((id) => selectedSet.has(id));
  const extraCols = selection ? 1 : 0;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200/80">
        <thead className="bg-slate-50/80">
          <tr>
            {selection && (
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = !!someSelected; }}
                  onChange={() => selection.onToggleAll(allIds)}
                  className="rounded border-slate-300 text-seekop-500 focus:ring-seekop-200"
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider ${col.className ?? ""}`}
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
                {selection && <td className="px-4 py-3"><div className="h-4 w-4 bg-gray-100 rounded" /></td>}
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
                  </td>
                ))}
              </tr>
            ))
          ) : isError ? (
            <tr>
              <td colSpan={columns.length + extraCols} className="px-4 py-10 text-center">
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
              <td colSpan={columns.length + extraCols} className="px-4 py-10 text-center">
                <div className="flex flex-col items-center gap-2">
                  <Inbox size={24} className="text-gray-300" />
                  <p className="text-sm text-gray-400">{emptyMessage}</p>
                </div>
              </td>
            </tr>
          ) : (
            data.map((row, idx) => {
              const id = selection ? selection.getRowId(row) : "";
              const isSelected = selection && selectedSet.has(id);
              return (
                <tr
                  key={idx}
                  className={`transition-colors ${isSelected ? "bg-seekop-50" : "hover:bg-seekop-50/60"}`}
                >
                  {selection && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => selection.onToggle(id)}
                        className="rounded border-slate-300 text-seekop-500 focus:ring-seekop-200"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 whitespace-nowrap text-sm text-gray-700 ${col.className ?? ""}`}>
                      {col.render
                        ? col.render(row)
                        : String((row as Record<string, unknown>)[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
