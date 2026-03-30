"use client";

import React from "react";
import { Calendar, User, MessageSquare, Hash, ExternalLink } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import RequestTimeline from "@/components/vacations/RequestTimeline";
import type { VacationRequest } from "@/types";
import { formatDate } from "@/lib/format";
interface RequestDetailModalProps {
  open: boolean;
  onClose: () => void;
  request: VacationRequest | null;
  onToast?: (type: "success" | "error", msg: string) => void;
}

function buildGoogleCalendarUrl(req: VacationRequest): string {
  const title = encodeURIComponent(`Vacaciones - ${req.employeeName}`);
  const startDate = req.startDate.replace(/-/g, "");
  const endRaw = new Date(req.endDate + "T00:00:00");
  endRaw.setDate(endRaw.getDate() + 1);
  const endDate = endRaw.toISOString().slice(0, 10).replace(/-/g, "");
  const details = encodeURIComponent(
    `Solicitud de vacaciones aprobada.\nDías hábiles: ${req.requestedBusinessDays}${
      req.employeeComment ? `\nComentario: ${req.employeeComment}` : ""
    }`
  );
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${details}`;
}

export default function RequestDetailModal({
  open,
  onClose,
  request,
}: RequestDetailModalProps) {
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

        {/* Export to Google Calendar */}
        {request.status === "APPROVED" && (
          <div className="flex justify-center">
            <a
              href={buildGoogleCalendarUrl(request)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="secondary" className="gap-2">
                <ExternalLink size={16} />
                Agregar a Google Calendar
              </Button>
            </a>
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
