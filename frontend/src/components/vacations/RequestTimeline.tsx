"use client";

import React from "react";
import {
  Clock,
  Send,
  CheckCircle2,
  XCircle,
  Ban,
  Pencil,
} from "lucide-react";
import type { VacationRequest } from "@/types";
import { formatDate, formatDateTime } from "@/lib/format";

interface TimelineStep {
  icon: React.ReactNode;
  label: string;
  detail: string;
  time?: string;
  active: boolean;
  color: string;
}

interface RequestTimelineProps {
  request: VacationRequest;
}

export default function RequestTimeline({ request }: RequestTimelineProps) {
  const steps: TimelineStep[] = [];

  // Step 1: Created
  steps.push({
    icon: <Send size={16} />,
    label: "Solicitud creada",
    detail: `${request.employeeName} solicitó ${request.requestedBusinessDays} día(s) del ${formatDate(request.startDate)} al ${formatDate(request.endDate)}`,
    time: request.createdAt ? formatDateTime(request.createdAt) : undefined,
    active: true,
    color: "bg-blue-500",
  });

  // Step 2: Pending / waiting
  if (request.status === "PENDING") {
    steps.push({
      icon: <Clock size={16} />,
      label: "Pendiente de revisión",
      detail: "Esperando decisión del manager",
      active: true,
      color: "bg-amber-500",
    });
  }

  // Step 3: Decision
  if (request.status === "APPROVED") {
    steps.push({
      icon: <CheckCircle2 size={16} />,
      label: "Aprobada",
      detail: request.decisionByName
        ? `Aprobada por ${request.decisionByName}${request.decisionComment ? `: "${request.decisionComment}"` : ""}`
        : "Solicitud aprobada",
      time: request.decidedAt ? formatDateTime(request.decidedAt) : undefined,
      active: true,
      color: "bg-emerald-500",
    });
  }

  if (request.status === "REJECTED") {
    steps.push({
      icon: <XCircle size={16} />,
      label: "Rechazada",
      detail: request.decisionByName
        ? `Rechazada por ${request.decisionByName}${request.decisionComment ? `: "${request.decisionComment}"` : ""}`
        : "Solicitud rechazada",
      time: request.decidedAt ? formatDateTime(request.decidedAt) : undefined,
      active: true,
      color: "bg-red-500",
    });
  }

  if (request.status === "CANCELED") {
    steps.push({
      icon: <Ban size={16} />,
      label: "Cancelada",
      detail: "Cancelada por el empleado",
      active: true,
      color: "bg-gray-500",
    });
  }

  return (
    <div className="relative">
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        return (
          <div key={idx} className="flex gap-3">
            {/* Vertical line + circle */}
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 ${step.color}`}
              >
                {step.icon}
              </div>
              {!isLast && (
                <div className="w-0.5 flex-1 bg-gray-200 my-1" />
              )}
            </div>

            {/* Content */}
            <div className={`pb-5 ${isLast ? "" : ""}`}>
              <p className="text-sm font-semibold text-gray-900">
                {step.label}
              </p>
              <p className="text-sm text-gray-600 mt-0.5">{step.detail}</p>
              {step.time && (
                <p className="text-xs text-gray-400 mt-0.5">{step.time}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
