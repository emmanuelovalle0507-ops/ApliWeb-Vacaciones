import { ROLE_LABELS, STATUS_LABELS } from "@/types";
import type { UserRole, RequestStatus } from "@/types";

/** Format YYYY-MM-DD to locale readable date */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Format ISO string to locale readable datetime */
export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function roleLabel(role: UserRole): string {
  return ROLE_LABELS[role] ?? role;
}

export function statusLabel(status: RequestStatus): string {
  return STATUS_LABELS[status] ?? status;
}
