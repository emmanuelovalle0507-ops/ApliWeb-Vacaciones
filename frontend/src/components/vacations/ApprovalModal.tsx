"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { decisionSchema, type DecisionFormData } from "@/types/schemas";
import { StatusBadge } from "@/components/ui/Badge";
import Textarea from "@/components/ui/Textarea";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import type { VacationRequest } from "@/types";
import { formatDate } from "@/lib/format";

type Action = "approve" | "reject";

const rejectSchema = z.object({
  comment: z.string().min(1, "El motivo de rechazo es obligatorio").max(500, "Máximo 500 caracteres"),
});

interface ApprovalModalProps {
  open: boolean;
  onClose: () => void;
  request: VacationRequest | null;
  action: Action;
  onConfirm: (requestId: string, comment?: string) => Promise<void>;
}

const actionConfig: Record<Action, { title: string; confirmLabel: string; variant: "success" | "danger" }> = {
  approve: { title: "Confirmar Aprobación", confirmLabel: "Aprobar Solicitud", variant: "success" },
  reject: { title: "Confirmar Rechazo", confirmLabel: "Rechazar Solicitud", variant: "danger" },
};

export default function ApprovalModal({
  open,
  onClose,
  request,
  action,
  onConfirm,
}: ApprovalModalProps) {
  const config = actionConfig[action];
  const schema = action === "reject" ? rejectSchema : decisionSchema;
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<DecisionFormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => { reset(); }, [action, open, reset]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = async (data: DecisionFormData) => {
    if (!request) return;
    await onConfirm(request.id, data.comment);
    reset();
  };

  if (!request) return null;

  return (
    <Modal open={open} onClose={handleClose} title={config.title}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-4">
          {/* Request details */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <span className="text-gray-500">Empleado</span>
            <span className="font-medium text-gray-900">{request.employeeName}</span>

            <span className="text-gray-500">Área</span>
            <span className="font-medium text-gray-900">{request.employeeArea}</span>

            <span className="text-gray-500">Fechas</span>
            <span className="font-medium text-gray-900">
              {formatDate(request.startDate)} → {formatDate(request.endDate)}
            </span>

            <span className="text-gray-500">Días hábiles</span>
            <span className="font-medium text-gray-900">{request.requestedBusinessDays}</span>

            <span className="text-gray-500">Estado</span>
            <span><StatusBadge status={request.status} /></span>
          </div>

          {request.employeeComment && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Comentario del empleado</p>
              <p className="text-sm text-gray-700">{request.employeeComment}</p>
            </div>
          )}

          <Textarea
            label={action === "reject" ? "Motivo de rechazo (obligatorio)" : "Comentario de decisión (opcional)"}
            placeholder={action === "reject" ? "Explica el motivo del rechazo..." : "Motivo de la decisión..."}
            error={errors.comment?.message}
            {...register("comment")}
          />
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" variant={config.variant} loading={isSubmitting}>
            {config.confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
