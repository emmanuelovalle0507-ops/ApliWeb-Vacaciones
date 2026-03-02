"use client";

import React from "react";
import Modal from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/Badge";
import type { VacationRequest } from "@/types";
import { formatDate } from "@/lib/format";

interface CancelDialogProps {
  open: boolean;
  onClose: () => void;
  request: VacationRequest | null;
  onConfirm: (requestId: string) => Promise<void>;
  loading?: boolean;
}

export default function CancelDialog({
  open,
  onClose,
  request,
  onConfirm,
  loading = false,
}: CancelDialogProps) {
  if (!request) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cancelar Solicitud"
      confirmLabel="Sí, cancelar solicitud"
      confirmVariant="danger"
      onConfirm={() => onConfirm(request.id)}
      loading={loading}
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          ¿Estás seguro de que deseas cancelar esta solicitud? Esta acción no se puede deshacer.
        </p>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm p-3 bg-gray-50 rounded-lg">
          <span className="text-gray-500">Fechas</span>
          <span className="font-medium text-gray-900">
            {formatDate(request.startDate)} → {formatDate(request.endDate)}
          </span>

          <span className="text-gray-500">Días hábiles</span>
          <span className="font-medium text-gray-900">{request.requestedBusinessDays}</span>

          <span className="text-gray-500">Estado</span>
          <span><StatusBadge status={request.status} /></span>
        </div>
      </div>
    </Modal>
  );
}
