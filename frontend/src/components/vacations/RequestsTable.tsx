"use client";

import React from "react";
import Table, { type Column } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import type { VacationRequest } from "@/types";
import { formatDate } from "@/lib/format";

interface RequestsTableProps {
  data: VacationRequest[];
  isLoading?: boolean;
  showEmployee?: boolean;
  showActions?: boolean;
  readOnly?: boolean;
  onApprove?: (req: VacationRequest) => void;
  onReject?: (req: VacationRequest) => void;
  onCancel?: (req: VacationRequest) => void;
  onView?: (req: VacationRequest) => void;
  emptyMessage?: string;
}

export default function RequestsTable({
  data,
  isLoading,
  showEmployee = false,
  showActions = false,
  readOnly = false,
  onApprove,
  onReject,
  onCancel,
  onView,
  emptyMessage = "No hay solicitudes.",
}: RequestsTableProps) {
  const columns: Column<VacationRequest>[] = [];

  if (showEmployee) {
    columns.push(
      { key: "employeeName", header: "Empleado" },
      { key: "employeeArea", header: "Área" }
    );
  }

  columns.push(
    {
      key: "startDate",
      header: "Inicio",
      render: (row) => formatDate(row.startDate),
    },
    {
      key: "endDate",
      header: "Fin",
      render: (row) => formatDate(row.endDate),
    },
    { key: "requestedBusinessDays", header: "Días" },
    {
      key: "status",
      header: "Estado",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "createdAt",
      header: "Creada",
      render: (row) => formatDate(row.createdAt),
    }
  );

  if (showActions) {
    columns.push({
      key: "actions",
      header: "Acciones",
      render: (row) => {
        if (readOnly) {
          return onView ? (
            <Button size="sm" variant="ghost" onClick={() => onView(row)}>
              Ver detalle
            </Button>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          );
        }

        if (row.status === "PENDING") {
          return (
            <div className="flex gap-2">
              {onApprove && (
                <Button size="sm" variant="success" onClick={() => onApprove(row)}>
                  Aprobar
                </Button>
              )}
              {onReject && (
                <Button size="sm" variant="danger" onClick={() => onReject(row)}>
                  Rechazar
                </Button>
              )}
              {onCancel && (
                <Button size="sm" variant="ghost" onClick={() => onCancel(row)}>
                  Cancelar
                </Button>
              )}
            </div>
          );
        }

        return onView ? (
          <Button size="sm" variant="ghost" onClick={() => onView(row)}>
            Ver detalle
          </Button>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        );
      },
    });
  }

  return (
    <Table columns={columns} data={data} isLoading={isLoading} emptyMessage={emptyMessage} />
  );
}
