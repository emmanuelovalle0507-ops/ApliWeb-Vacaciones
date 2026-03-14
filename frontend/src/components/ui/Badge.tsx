"use client";

import React from "react";
import type { RequestStatus, EmailStatus } from "@/types";
import { STATUS_LABELS } from "@/types";

const statusStyles: Record<RequestStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
  APPROVED: "bg-green-100 text-green-800 border-green-200",
  REJECTED: "bg-red-100 text-red-800 border-red-200",
  CANCELED: "bg-gray-100 text-gray-600 border-gray-200",
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusStyles[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

const sendStyles: Record<EmailStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
  SENT: "bg-green-100 text-green-800 border-green-200",
  FAILED: "bg-red-100 text-red-800 border-red-200",
  SKIPPED: "bg-gray-100 text-gray-600 border-gray-200",
};

const sendLabels: Record<EmailStatus, string> = {
  PENDING: "Pendiente",
  SENT: "Enviado",
  FAILED: "Fallido",
  SKIPPED: "Omitido",
};

export function SendStatusBadge({ status }: { status: EmailStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${sendStyles[status]}`}
    >
      {sendLabels[status]}
    </span>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    ADMIN: "bg-slate-100 text-slate-800 border-slate-200",
    MANAGER: "bg-seekop-100 text-seekop-800 border-seekop-200",
    EMPLOYEE: "bg-[#9ab236]/15 text-[#6f8425] border-[#9ab236]/30",
    HR: "bg-seekop-50 text-seekop-700 border-seekop-200",
  };
  const labels: Record<string, string> = {
    ADMIN: "Admin",
    MANAGER: "Manager",
    EMPLOYEE: "Empleado",
    HR: "RRHH",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[role] ?? "bg-gray-100 text-gray-800 border-gray-200"}`}
    >
      {labels[role] ?? role}
    </span>
  );
}
