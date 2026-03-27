"use client";

import React from "react";
import { Calendar, User, MessageSquare, Hash, Download } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import RequestTimeline from "@/components/vacations/RequestTimeline";
import type { VacationRequest } from "@/types";
import { formatDate } from "@/lib/format";
import { api } from "@/api/client";

interface RequestDetailModalProps {
  open: boolean;
  onClose: () => void;
  request: VacationRequest | null;
  onToast?: (type: "success" | "error", msg: string) => void;
}

export default function RequestDetailModal({
  open,
  onClose,
  request,
  onToast,
}: RequestDetailModalProps) {
  const handleExportICS = () => {
    if (!request) return;
    api.calendarExport.exportICS(request.id)
      .then(() => onToast?.("success", "Archivo .ics descargado"))
      .catch((e: Error) => onToast?.("error", e.message || "Error al exportar"));
  };
  if (!request) return null;

  return (
    <Modal open={open} onClose={onClose} title="Detalle de Solicitud" size="lg">
      <div className="space-y-5">
        {/* Summary card */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm p-4 bg-gray-50 rounded-xl">
          <div className="flex items-center gap-2">
            <User size={14} className="text-gray-400" />
            <span className="text-gray-500">Empleado</span>
          </div>
          <span className="font-medium text-gray-900">{request.employeeName}</span>

          <div className="flex items-center gap-2">
            <Hash size={14} className="text-gray-400" />
            <span className="text-gray-500">Área</span>
          </div>
          <span className="font-medium text-gray-900">{request.employeeArea}</span>

          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-gray-400" />
            <span className="text-gray-500">Fechas</span>
          </div>
          <span className="font-medium text-gray-900">
            {formatDate(request.startDate)} → {formatDate(request.endDate)}
          </span>

          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-gray-400" />
            <span className="text-gray-500">Días hábiles</span>
          </div>
          <span className="font-medium text-gray-900">{request.requestedBusinessDays}</span>

          <div className="flex items-center gap-2">
            <span className="text-gray-500 ml-5">Estado</span>
          </div>
          <StatusBadge status={request.status} />

          {request.employeeComment && (
            <>
              <div className="flex items-center gap-2">
                <MessageSquare size={14} className="text-gray-400" />
                <span className="text-gray-500">Comentario</span>
              </div>
              <span className="text-gray-700 italic">&ldquo;{request.employeeComment}&rdquo;</span>
            </>
          )}
        </div>

        {/* Export to calendar */}
        {request.status === "APPROVED" && (
          <div className="flex justify-center">
            <Button variant="secondary" onClick={handleExportICS} className="gap-2">
              <Download size={16} />
              Agregar a Google Calendar / Outlook
            </Button>
          </div>
        )}

        {/* Timeline */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Historial</h4>
          <RequestTimeline request={request} />
        </div>
      </div>
    </Modal>
  );
}
