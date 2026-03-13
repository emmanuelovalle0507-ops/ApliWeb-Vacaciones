import type {
  User,
  VacationBalance,
  VacationRequest,
  NotificationEvent,
  Area,
} from "@/types";
import { businessDaysBetween } from "@/lib/dates";

// ── Areas ──────────────────────────────────────────────
export const AREAS: Area[] = [
  { id: "a1", name: "Ingeniería" },
  { id: "a2", name: "Marketing" },
  { id: "a3", name: "Recursos Humanos" },
  { id: "a4", name: "Ventas" },
];

// ── Users ──────────────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear();

const initialUsers: User[] = [
  { id: "u1", fullName: "Roberto Díaz", email: "admin@empresa.com", role: "ADMIN", area: AREAS[2] },
  { id: "u2", fullName: "Laura Vega", email: "hr@empresa.com", role: "HR", area: AREAS[2] },
  { id: "u3", fullName: "María García", email: "maria.garcia@empresa.com", role: "MANAGER", area: AREAS[0] },
  { id: "u4", fullName: "Pedro Sánchez", email: "pedro.sanchez@empresa.com", role: "MANAGER", area: AREAS[1] },
  { id: "u5", fullName: "Carlos López", email: "carlos.lopez@empresa.com", role: "EMPLOYEE", area: AREAS[0], managerId: "u3" },
  { id: "u6", fullName: "Ana Martínez", email: "ana.martinez@empresa.com", role: "EMPLOYEE", area: AREAS[0], managerId: "u3" },
  { id: "u7", fullName: "Jorge Ramírez", email: "jorge.ramirez@empresa.com", role: "EMPLOYEE", area: AREAS[1], managerId: "u4" },
  { id: "u8", fullName: "Sofía Hernández", email: "sofia.hernandez@empresa.com", role: "EMPLOYEE", area: AREAS[1], managerId: "u4" },
];

// ── Balances ───────────────────────────────────────────
const initialBalances: VacationBalance[] = [
  { userId: "u1", year: CURRENT_YEAR, grantedDays: 20, carriedOverDays: 0, usedDays: 0, availableDays: 20 },
  { userId: "u2", year: CURRENT_YEAR, grantedDays: 20, carriedOverDays: 0, usedDays: 0, availableDays: 20 },
  { userId: "u3", year: CURRENT_YEAR, grantedDays: 20, carriedOverDays: 3, usedDays: 5, availableDays: 18 },
  { userId: "u4", year: CURRENT_YEAR, grantedDays: 20, carriedOverDays: 2, usedDays: 0, availableDays: 22 },
  { userId: "u5", year: CURRENT_YEAR, grantedDays: 15, carriedOverDays: 3, usedDays: 5, availableDays: 13 },
  { userId: "u6", year: CURRENT_YEAR, grantedDays: 15, carriedOverDays: 5, usedDays: 10, availableDays: 10 },
  { userId: "u7", year: CURRENT_YEAR, grantedDays: 15, carriedOverDays: 2, usedDays: 5, availableDays: 12 },
  { userId: "u8", year: CURRENT_YEAR, grantedDays: 15, carriedOverDays: 0, usedDays: 0, availableDays: 15 },
];

// ── Requests ───────────────────────────────────────────
const initialRequests: VacationRequest[] = [
  {
    id: "r1", userId: "u5", employeeName: "Carlos López", employeeArea: "Ingeniería",
    startDate: `${CURRENT_YEAR}-03-10`, endDate: `${CURRENT_YEAR}-03-14`,
    requestedBusinessDays: 5, status: "APPROVED",
    decisionBy: "u3", decisionByName: "María García",
    decidedAt: `${CURRENT_YEAR}-02-20`, createdAt: `${CURRENT_YEAR}-02-15`,
  },
  {
    id: "r2", userId: "u5", employeeName: "Carlos López", employeeArea: "Ingeniería",
    startDate: `${CURRENT_YEAR}-06-02`, endDate: `${CURRENT_YEAR}-06-06`,
    requestedBusinessDays: 5, status: "PENDING",
    createdAt: `${CURRENT_YEAR}-02-22`,
  },
  {
    id: "r3", userId: "u6", employeeName: "Ana Martínez", employeeArea: "Ingeniería",
    startDate: `${CURRENT_YEAR}-04-07`, endDate: `${CURRENT_YEAR}-04-11`,
    requestedBusinessDays: 5, status: "PENDING",
    employeeComment: "Viaje familiar previamente planeado.",
    createdAt: `${CURRENT_YEAR}-02-20`,
  },
  {
    id: "r4", userId: "u6", employeeName: "Ana Martínez", employeeArea: "Ingeniería",
    startDate: `${CURRENT_YEAR}-01-13`, endDate: `${CURRENT_YEAR}-01-17`,
    requestedBusinessDays: 5, status: "APPROVED",
    decisionBy: "u3", decisionByName: "María García",
    decidedAt: `${CURRENT_YEAR}-01-05`, createdAt: `${CURRENT_YEAR}-01-02`,
  },
  {
    id: "r5", userId: "u7", employeeName: "Jorge Ramírez", employeeArea: "Marketing",
    startDate: `${CURRENT_YEAR}-05-19`, endDate: `${CURRENT_YEAR}-05-23`,
    requestedBusinessDays: 5, status: "PENDING",
    createdAt: `${CURRENT_YEAR}-02-23`,
  },
  {
    id: "r6", userId: "u5", employeeName: "Carlos López", employeeArea: "Ingeniería",
    startDate: `${CURRENT_YEAR - 1}-12-23`, endDate: `${CURRENT_YEAR - 1}-12-26`,
    requestedBusinessDays: 4, status: "REJECTED",
    decisionBy: "u3", decisionByName: "María García",
    decisionComment: "Período de cierre anual, no se permiten vacaciones.",
    decidedAt: `${CURRENT_YEAR - 1}-12-15`, createdAt: `${CURRENT_YEAR - 1}-12-10`,
  },
  {
    id: "r7", userId: "u8", employeeName: "Sofía Hernández", employeeArea: "Marketing",
    startDate: `${CURRENT_YEAR}-02-03`, endDate: `${CURRENT_YEAR}-02-07`,
    requestedBusinessDays: 5, status: "CANCELED",
    createdAt: `${CURRENT_YEAR}-01-20`,
  },
  {
    id: "r8", userId: "u7", employeeName: "Jorge Ramírez", employeeArea: "Marketing",
    startDate: `${CURRENT_YEAR}-03-03`, endDate: `${CURRENT_YEAR}-03-07`,
    requestedBusinessDays: 5, status: "APPROVED",
    decisionBy: "u4", decisionByName: "Pedro Sánchez",
    decidedAt: `${CURRENT_YEAR}-02-25`, createdAt: `${CURRENT_YEAR}-02-18`,
  },
];

// ── Notifications ──────────────────────────────────────
type MockNotification = NotificationEvent & { _ownerId: string };
const initialNotifications: MockNotification[] = [
  { id: "n1", _ownerId: "u3", type: "REQUEST_CREATED", title: "Nueva solicitud de vacaciones", body: "Carlos López ha solicitado vacaciones del 10/03 al 14/03 (5 días hábiles). Revísala y toma una decisión.", entityType: "vacation_request", entityId: "r3", isRead: false, emailStatus: "SENT", createdAt: `${CURRENT_YEAR}-02-22T10:00:00Z` },
  { id: "n2", _ownerId: "u5", type: "REQUEST_APPROVED", title: "Solicitud de vacaciones aprobada ✓", body: "Tu solicitud del 10/03 al 14/03 (5 días) fue aprobada por María García. ¡Disfruta tu descanso!", entityType: "vacation_request", entityId: "r1", isRead: true, emailStatus: "SENT", createdAt: `${CURRENT_YEAR}-02-20T14:30:00Z` },
  { id: "n3", _ownerId: "u5", type: "REQUEST_REJECTED", title: "Solicitud de vacaciones rechazada", body: "Tu solicitud del 23/12 al 26/12 fue rechazada por María García. Comentario: \"Período de cierre anual.\"", entityType: "vacation_request", entityId: "r6", isRead: true, emailStatus: "SENT", createdAt: `${CURRENT_YEAR - 1}-12-15T09:00:00Z` },
  { id: "n4", _ownerId: "u3", type: "REQUEST_CREATED", title: "Nueva solicitud de vacaciones", body: "Ana Martínez ha solicitado vacaciones del 20/02 al 24/02 (5 días hábiles). Revísala y toma una decisión.", entityType: "vacation_request", entityId: "r4", isRead: false, emailStatus: "SENT", createdAt: `${CURRENT_YEAR}-02-20T11:00:00Z` },
  { id: "n5", _ownerId: "u4", type: "REQUEST_CANCELLED", title: "Solicitud cancelada", body: "Sofía Hernández canceló su solicitud de vacaciones del 03/02 al 07/02.", entityType: "vacation_request", entityId: "r7", isRead: false, emailStatus: "SKIPPED", createdAt: `${CURRENT_YEAR}-01-21T08:00:00Z` },
  { id: "n6", _ownerId: "u6", type: "REQUEST_APPROVED", title: "Solicitud de vacaciones aprobada ✓", body: "Tu solicitud del 01/01 al 03/01 (3 días) fue aprobada por María García.", entityType: "vacation_request", entityId: "r2", isRead: false, emailStatus: "FAILED", createdAt: `${CURRENT_YEAR}-01-05T16:00:00Z` },
];

// ── Mutable In-Memory Store ────────────────────────────
let users = initialUsers.map((u) => ({ ...u, area: { ...u.area } }));
let balances = initialBalances.map((b) => ({ ...b }));
let requests = initialRequests.map((r) => ({ ...r }));
let notifications = initialNotifications.map((n) => ({ ...n }));
let nextId = 100;

export function genId(prefix: string): string {
  return `${prefix}${++nextId}`;
}

// ── User Queries ───────────────────────────────────────
export function findUserByEmail(email: string): User | undefined {
  return users.find((u) => u.email === email);
}
export function findUserById(id: string): User | undefined {
  return users.find((u) => u.id === id);
}
export function listUsers(): User[] {
  return [...users];
}

// ── Balance Queries ────────────────────────────────────
export function getBalance(userId: string, year: number): VacationBalance | undefined {
  return balances.find((b) => b.userId === userId && b.year === year);
}
export function listBalances(year: number): VacationBalance[] {
  return balances.filter((b) => b.year === year);
}

// ── Request Queries & Mutations ────────────────────────
export function listRequestsByUser(userId: string): VacationRequest[] {
  return requests.filter((r) => r.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listPendingForManager(managerId: string): VacationRequest[] {
  const employeeIds = users.filter((u) => u.managerId === managerId).map((u) => u.id);
  return requests.filter((r) => employeeIds.includes(r.userId) && r.status === "PENDING");
}

export function listAllRequests(): VacationRequest[] {
  return [...requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function findRequestById(id: string): VacationRequest | undefined {
  return requests.find((r) => r.id === id);
}

export function addRequest(req: VacationRequest): void {
  requests = [req, ...requests];
}

export function updateRequest(id: string, updates: Partial<VacationRequest>): VacationRequest | undefined {
  const idx = requests.findIndex((r) => r.id === id);
  if (idx === -1) return undefined;
  requests[idx] = { ...requests[idx], ...updates };
  return requests[idx];
}

// ── Notification Queries ───────────────────────────────
export function listNotificationsByUser(userId: string): NotificationEvent[] {
  return notifications
    .filter((n) => n._ownerId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ _ownerId, ...rest }) => rest);
}

// ── Balance Mutations ─────────────────────────────────
export function upsertBalance(balance: VacationBalance): VacationBalance {
  const idx = balances.findIndex(
    (b) => b.userId === balance.userId && b.year === balance.year
  );
  if (idx >= 0) {
    balances[idx] = { ...balance };
    return balances[idx];
  }
  balances.push({ ...balance });
  return balance;
}

export function updateBalance(
  userId: string,
  year: number,
  updates: Partial<VacationBalance>
): VacationBalance | undefined {
  const idx = balances.findIndex(
    (b) => b.userId === userId && b.year === year
  );
  if (idx === -1) return undefined;
  balances[idx] = { ...balances[idx], ...updates };
  return balances[idx];
}

// ── Notification Mutations ────────────────────────────
export function countUnreadByUser(userId: string): number {
  return notifications.filter((n) => n._ownerId === userId && !n.isRead).length;
}

export function markNotifRead(notifId: string, userId: string): boolean {
  const n = notifications.find((n) => n.id === notifId && n._ownerId === userId);
  if (!n) return false;
  n.isRead = true;
  return true;
}

export function markAllNotifsRead(userId: string): number {
  let count = 0;
  notifications.forEach((n) => {
    if (n._ownerId === userId && !n.isRead) {
      n.isRead = true;
      count++;
    }
  });
  return count;
}

export function addNotification(ownerId: string, n: NotificationEvent): void {
  notifications = [{ ...n, _ownerId: ownerId }, ...notifications];
}
