import type {
  AIChatAskResponse,
  AIChatHistoryItem,
  AuthResponse,
  TeamPolicyAgentRequestPayload,
  TeamPolicyAgentResponse,
  TeamPolicyOnboardingQuestionsResponse,
  TeamPolicyOut,
  User,
  VacationBalance,
  VacationRequest,
  NotificationEvent,
  CreateRequestPayload,
  UserFilters,
  RequestFilters,
  RolloverResult,
  PaginatedResponse,
  PaginationParams,
  CalendarEvent,
  UserCreatePayload,
  UserUpdatePayload,
  AuditLogEntry,
} from "@/types";
import { businessDaysBetween } from "@/lib/dates";
import type { ExpenseReceipt, ExpenseReport } from "@/api/real/client";
import * as db from "./db";

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

function paginate<T>(items: T[], params?: PaginationParams): PaginatedResponse<T> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    pagination: { page, pageSize, total, totalPages },
  };
}

// ── Auth ───────────────────────────────────────────────
export async function login(email: string, _password: string): Promise<AuthResponse> {
  await delay(500);
  const user = db.findUserByEmail(email);
  if (!user) throw new Error("Usuario no encontrado");
  return { token: `mock-token-${user.id}-${Date.now()}`, user };
}

export async function logout(): Promise<void> {
  await delay(100);
}

// ── Me ─────────────────────────────────────────────────
export async function getMe(userId: string): Promise<User> {
  await delay(200);
  const user = db.findUserById(userId);
  if (!user) throw new Error("Usuario no encontrado");
  return user;
}

// ── Balance ────────────────────────────────────────────
export async function getMyBalance(userId: string, year: number): Promise<VacationBalance> {
  await delay(200);
  const balance = db.getBalance(userId, year);
  if (!balance) {
    return {
      userId,
      year,
      grantedDays: 0,
      carriedOverDays: 0,
      usedDays: 0,
      availableDays: 0,
    };
  }
  return balance;
}

// ── Requests ───────────────────────────────────────────
export async function preValidateRequest(
  startDate: string,
  endDate: string
): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
  requestedDays: number;
  balanceByYear: Record<number, { requested: number; available: number }>;
}> {
  await delay(300);
  const start = new Date(startDate);
  const end = new Date(endDate);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (end < start) errors.push("La fecha de fin debe ser igual o posterior a la de inicio.");
  if (start < new Date()) errors.push("La fecha de inicio no puede ser en el pasado.");

  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const businessDays = Math.ceil(days * 5 / 7);
  const year = start.getFullYear();

  if (businessDays > 12) {
    errors.push(`No tienes suficientes días para el año ${year}. Disponibles: 12, solicitados: ${businessDays}.`);
  } else if (12 - businessDays <= 2) {
    warnings.push(`Después de esta solicitud solo te quedarían ${12 - businessDays} día(s) para ${year}.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    requestedDays: businessDays,
    balanceByYear: { [year]: { requested: businessDays, available: 12 } },
  };
}

export async function createRequest(
  userId: string,
  payload: CreateRequestPayload
): Promise<VacationRequest> {
  await delay(400);
  const user = db.findUserById(userId);
  if (!user) throw new Error("Usuario no encontrado");

  const bizDays = businessDaysBetween(payload.startDate, payload.endDate);
  if (bizDays <= 0) throw new Error("Rango de fechas inválido");

  const year = new Date().getFullYear();
  const balance = db.getBalance(userId, year);
  if (balance && bizDays > balance.availableDays) {
    throw new Error(`No tienes suficientes días disponibles (disponibles: ${balance.availableDays}, solicitados: ${bizDays})`);
  }

  const req: VacationRequest = {
    id: db.genId("r"),
    userId,
    employeeName: user.fullName,
    employeeArea: user.area.name,
    startDate: payload.startDate,
    endDate: payload.endDate,
    requestedBusinessDays: bizDays,
    status: "PENDING",
    employeeComment: payload.employeeComment,
    createdAt: new Date().toISOString().split("T")[0],
  };
  db.addRequest(req);

  // mock notification to manager
  if (user.managerId) {
    const manager = db.findUserById(user.managerId);
    if (manager) {
      db.addNotification(manager.id, {
        id: db.genId("n"),
        type: "REQUEST_CREATED",
        title: "Nueva solicitud de vacaciones",
        body: `${user.fullName} ha solicitado vacaciones del ${payload.startDate} al ${payload.endDate}.`,
        entityType: "vacation_request",
        entityId: req.id,
        isRead: false,
        emailStatus: "SENT",
        createdAt: new Date().toISOString(),
      });
    }
  }

  return req;
}

export async function listMyRequests(
  userId: string,
  pagination?: PaginationParams,
  filters?: { status?: string; startDate?: string; endDate?: string },
): Promise<PaginatedResponse<VacationRequest>> {
  await delay(200);
  let all = db.listRequestsByUser(userId);
  if (filters?.status) all = all.filter((r) => r.status === filters.status);
  if (filters?.startDate) all = all.filter((r) => r.startDate >= filters.startDate!);
  if (filters?.endDate) all = all.filter((r) => r.endDate <= filters.endDate!);
  return paginate(all, pagination);
}

export async function getRequest(requestId: string): Promise<VacationRequest> {
  await delay(200);
  const req = db.findRequestById(requestId);
  if (!req) throw new Error("Solicitud no encontrada");
  return req;
}

export async function editRequest(
  requestId: string,
  userId: string,
  payload: CreateRequestPayload
): Promise<VacationRequest> {
  await delay(400);
  const req = db.findRequestById(requestId);
  if (!req) throw new Error("Solicitud no encontrada");
  if (req.userId !== userId) throw new Error("No autorizado");
  if (req.status !== "PENDING") throw new Error("Solo se pueden editar solicitudes pendientes");

  const bizDays = businessDaysBetween(payload.startDate, payload.endDate);
  if (bizDays <= 0) throw new Error("Rango de fechas inválido");

  const updated = db.updateRequest(requestId, {
    startDate: payload.startDate,
    endDate: payload.endDate,
    requestedBusinessDays: bizDays,
    employeeComment: payload.employeeComment,
  });
  if (!updated) throw new Error("Error al editar");
  return updated;
}

export async function cancelRequest(requestId: string, userId: string): Promise<VacationRequest> {
  await delay(300);
  const req = db.findRequestById(requestId);
  if (!req) throw new Error("Solicitud no encontrada");
  if (req.userId !== userId) throw new Error("No autorizado");
  if (req.status !== "PENDING" && req.status !== "APPROVED") throw new Error("Solo se pueden cancelar solicitudes pendientes o aprobadas");

  const today = new Date().toISOString().slice(0, 10);
  if (req.status === "APPROVED" && req.startDate <= today) {
    throw new Error("No puedes cancelar vacaciones aprobadas que ya iniciaron o están en curso.");
  }

  const updated = db.updateRequest(requestId, { status: "CANCELED" });
  if (!updated) throw new Error("Error al cancelar");

  // Refund balance if was approved
  if (req.status === "APPROVED") {
    const year = new Date(req.startDate).getFullYear();
    const balance = db.getBalance(userId, year);
    if (balance) {
      db.updateBalance(userId, year, {
        availableDays: balance.availableDays + req.requestedBusinessDays,
        usedDays: Math.max(0, balance.usedDays - req.requestedBusinessDays),
      });
    }
  }

  return updated;
}

// ── Approvals ──────────────────────────────────────────
export async function listPending(managerId: string, pagination?: PaginationParams): Promise<PaginatedResponse<VacationRequest>> {
  await delay(200);
  const all = db.listPendingForManager(managerId);
  return paginate(all, pagination);
}

export async function approveRequest(
  requestId: string,
  deciderId: string,
  comment?: string
): Promise<VacationRequest> {
  await delay(400);
  const req = db.findRequestById(requestId);
  if (!req) throw new Error("Solicitud no encontrada");
  if (req.status !== "PENDING") throw new Error("La solicitud ya fue decidida");

  const decider = db.findUserById(deciderId);
  const updated = db.updateRequest(requestId, {
    status: "APPROVED",
    decisionBy: deciderId,
    decisionByName: decider?.fullName,
    decisionComment: comment,
    decidedAt: new Date().toISOString().split("T")[0],
  });
  if (!updated) throw new Error("Error al aprobar");

  // notification to employee
  const employee = db.findUserById(req.userId);
  if (employee) {
    db.addNotification(employee.id, {
      id: db.genId("n"),
      type: "REQUEST_APPROVED",
      title: "Solicitud de vacaciones aprobada ✓",
      body: `Tu solicitud del ${req.startDate} al ${req.endDate} fue aprobada por ${decider?.fullName ?? "tu manager"}. ¡Disfruta tu descanso!`,
      entityType: "vacation_request",
      entityId: req.id,
      isRead: false,
      emailStatus: "SENT",
      createdAt: new Date().toISOString(),
    });
  }

  return updated;
}

export async function rejectRequest(
  requestId: string,
  deciderId: string,
  comment?: string
): Promise<VacationRequest> {
  await delay(400);
  const req = db.findRequestById(requestId);
  if (!req) throw new Error("Solicitud no encontrada");
  if (req.status !== "PENDING") throw new Error("La solicitud ya fue decidida");

  const decider = db.findUserById(deciderId);
  const updated = db.updateRequest(requestId, {
    status: "REJECTED",
    decisionBy: deciderId,
    decisionByName: decider?.fullName,
    decisionComment: comment,
    decidedAt: new Date().toISOString().split("T")[0],
  });
  if (!updated) throw new Error("Error al rechazar");

  const employee = db.findUserById(req.userId);
  if (employee) {
    db.addNotification(employee.id, {
      id: db.genId("n"),
      type: "REQUEST_REJECTED",
      title: "Solicitud de vacaciones rechazada",
      body: `Tu solicitud del ${req.startDate} al ${req.endDate} fue rechazada por ${decider?.fullName ?? "tu manager"}.${comment ? ` Comentario: "${comment}"` : ""}`,
      entityType: "vacation_request",
      entityId: req.id,
      isRead: false,
      emailStatus: "SENT",
      createdAt: new Date().toISOString(),
    });
  }

  return updated;
}

export async function listAuditLogs(
  _action?: string,
  _entityType?: string,
  pagination?: PaginationParams,
): Promise<PaginatedResponse<AuditLogEntry>> {
  await delay(200);
  return paginate([], pagination);
}

export async function listTeamHistory(status?: string, pagination?: PaginationParams): Promise<PaginatedResponse<VacationRequest>> {
  await delay(200);
  let result = db.listAllRequests();
  if (status) result = result.filter((r) => r.status === status);
  return paginate(result, pagination);
}

// ── Admin ──────────────────────────────────────────────
export async function listUsers(filters?: UserFilters, pagination?: PaginationParams): Promise<PaginatedResponse<User>> {
  await delay(200);
  let result = db.listUsers();
  if (filters?.role) result = result.filter((u) => u.role === filters.role);
  if (filters?.areaId) result = result.filter((u) => u.area.id === filters.areaId);
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    result = result.filter(
      (u) => u.fullName.toLowerCase().includes(s) || u.email.toLowerCase().includes(s)
    );
  }
  return paginate(result, pagination);
}

export async function listAllRequests(filters?: RequestFilters, pagination?: PaginationParams): Promise<PaginatedResponse<VacationRequest>> {
  await delay(200);
  let result = db.listAllRequests();
  if (filters?.status) result = result.filter((r) => r.status === filters.status);
  if (filters?.areaId) {
    const areaUsers = db.listUsers().filter((u) => u.area.id === filters.areaId);
    const ids = areaUsers.map((u) => u.id);
    result = result.filter((r) => ids.includes(r.userId));
  }
  if (filters?.startDate) result = result.filter((r) => r.startDate >= filters.startDate!);
  if (filters?.endDate) result = result.filter((r) => r.endDate <= filters.endDate!);
  return paginate(result, pagination);
}

export async function listAllBalances(year: number, pagination?: PaginationParams): Promise<PaginatedResponse<VacationBalance & { userName: string; userArea: string }>> {
  await delay(200);
  const all = db.listBalances(year).map((b) => {
    const user = db.findUserById(b.userId);
    return { ...b, userName: user?.fullName ?? "—", userArea: user?.area.name ?? "—" };
  });
  return paginate(all, pagination);
}

export async function listTeams(): Promise<{ id: string; name: string }[]> {
  await delay(200);
  return db.AREAS.map((a) => ({ id: a.id, name: a.name }));
}

export async function listTeamMembers(): Promise<User[]> {
  await delay(200);
  return db.listUsers().filter((u) => u.role === "EMPLOYEE");
}

// ── User CRUD (mock stubs) ─────────────────────────────
export async function createUser(payload: UserCreatePayload): Promise<User> {
  await delay(400);
  return {
    id: `mock-${Date.now()}`,
    fullName: payload.fullName,
    email: payload.email,
    role: payload.role as User["role"],
    area: { id: payload.teamId ?? "no-team", name: "Equipo General" },
    managerId: payload.managerIds[0],
    managerIds: payload.managerIds,
    isActive: true,
    hireDate: payload.hireDate,
    position: payload.position,
  };
}

export async function updateUser(userId: string, payload: UserUpdatePayload): Promise<User> {
  await delay(300);
  const user = db.findUserById(userId) ?? db.listUsers()[0];
  return {
    ...user,
    fullName: payload.fullName ?? user.fullName,
    role: (payload.role as User["role"]) ?? user.role,
    managerIds: payload.managerIds ?? user.managerIds ?? [],
    isActive: payload.isActive ?? user.isActive ?? true,
    hireDate: payload.hireDate ?? user.hireDate,
    position: payload.position ?? user.position,
  };
}

export async function deactivateUser(userId: string): Promise<User> {
  await delay(300);
  const user = db.findUserById(userId) ?? db.listUsers()[0];
  return { ...user, isActive: false };
}

export async function deleteUserPermanently(userId: string): Promise<{ detail: string }> {
  await delay(500);
  return { detail: `Usuario ${userId} eliminado permanentemente.` };
}

export async function changePassword(_currentPassword: string, _newPassword: string): Promise<void> {
  await delay(400);
}

// ── Calendar ────────────────────────────────────────────
export async function getCalendarEvents(month: string, _teamId?: string): Promise<CalendarEvent[]> {
  await delay(200);
  const allRequests = db.listAllRequests().filter(
    (r) => r.status === "APPROVED" || r.status === "PENDING"
  );
  const [yearStr, monthStr] = month.split("-");
  const y = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10);
  const monthStart = `${month}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;

  return allRequests
    .filter((r) => r.startDate <= monthEnd && r.endDate >= monthStart)
    .map((r) => ({
      requestId: r.id,
      employeeId: r.userId,
      employeeName: r.employeeName,
      teamId: undefined,
      startDate: r.startDate,
      endDate: r.endDate,
      status: r.status as CalendarEvent["status"],
    }));
}

// ── Notifications ──────────────────────────────────────
export async function listMyNotifications(userId: string, pagination?: PaginationParams): Promise<PaginatedResponse<NotificationEvent> & { unreadCount: number }> {
  await delay(200);
  const all = db.listNotificationsByUser(userId);
  const unreadCount = db.countUnreadByUser(userId);
  const paged = paginate(all, pagination);
  return { ...paged, unreadCount };
}

export async function getUnreadCount(): Promise<number> {
  await delay(100);
  const stored = typeof window !== "undefined" ? localStorage.getItem("mock_user_id") : null;
  return db.countUnreadByUser(stored ?? "u5");
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await delay(150);
  const stored = typeof window !== "undefined" ? localStorage.getItem("mock_user_id") : null;
  db.markNotifRead(notificationId, stored ?? "u5");
}

export async function markAllNotificationsRead(): Promise<number> {
  await delay(200);
  const stored = typeof window !== "undefined" ? localStorage.getItem("mock_user_id") : null;
  return db.markAllNotifsRead(stored ?? "u5");
}

// ── AI Chat ─────────────────────────────────────────────
export async function askAIChat(question: string): Promise<AIChatAskResponse> {
  await delay(800);
  const q = question.toLowerCase();

  if (q.includes("saldo") || q.includes("días") || q.includes("quedan")) {
    return {
      answer: "Tu saldo actual (demo): 15 días otorgados, 3 usados, 12 disponibles para el año 2026.",
      scope: "PERSONAL",
      toolResultsUsed: ["get_my_balance"],
      conversationId: `mock-${Date.now()}`,
    };
  }

  if (q.includes("estado") || q.includes("resumen")) {
    return {
      answer: "Estado actual (demo): equipo con 4 empleados activos, 1 fuera hoy y 2 solicitudes pendientes.",
      scope: "TEAM",
      toolResultsUsed: ["get_team_summary"],
      conversationId: `mock-${Date.now()}`,
    };
  }

  if (q.includes("solicitud") || q.includes("mis vacacion")) {
    return {
      answer: "Tus solicitudes recientes (demo):\n• 2026-01-15 a 2026-01-17 (3 días) — APPROVED\n• 2026-03-10 a 2026-03-14 (5 días) — PENDING",
      scope: "PERSONAL",
      toolResultsUsed: ["list_my_requests"],
      conversationId: `mock-${Date.now()}`,
    };
  }

  if (q.includes("pendiente") || q.includes("aprob") || q.includes("rechaz")) {
    return {
      answer: "Solicitudes pendientes del equipo (demo):\n• Carlos López: 2026-03-10 a 2026-03-14 (5d) — PENDING\n• Ana García: 2026-04-01 a 2026-04-05 (5d) — PENDING",
      scope: "TEAM",
      toolResultsUsed: ["list_team_requests"],
      conversationId: `mock-${Date.now()}`,
    };
  }

  if (q.includes("global") || q.includes("resumen general") || q.includes("organización")) {
    return {
      answer: "Resumen global (demo): 25 empleados activos, 3 fuera hoy, 5 solicitudes pendientes.\nEmpleados con saldo bajo (<3 días): Juan Pérez (2d), María López (1d).",
      scope: "GLOBAL",
      toolResultsUsed: ["get_global_summary"],
      conversationId: `mock-${Date.now()}`,
    };
  }

  return {
    answer:
      "Solo puedo ayudarte con datos de la app de vacaciones (saldos, solicitudes, estado del equipo, aprobaciones/rechazos y políticas).",
    scope: "PERSONAL",
    toolResultsUsed: [],
    conversationId: `mock-${Date.now()}`,
  };
}

export async function listAIChatHistory(): Promise<AIChatHistoryItem[]> {
  await delay(200);
  return [
    {
      id: 1,
      question: "¿Cuántos días me quedan?",
      answer: "Tu saldo actual (demo): 15 días otorgados, 3 usados, 12 disponibles para el año 2026.",
      scope: "PERSONAL",
      role: "EMPLOYEE",
      toolsUsed: "get_my_balance",
      latencyMs: 320,
      createdAt: new Date().toISOString(),
    },
  ];
}

// ── Team Policies (Agentic Setup) ─────────────────────
export async function upsertTeamPolicy(payload: {
  teamId: string;
  maxPeopleOffPerDay: number;
  minNoticeDays: number;
  effectiveFrom: string;
  effectiveTo?: string;
}): Promise<TeamPolicyOut> {
  await delay(400);
  return {
    id: Date.now(),
    teamId: payload.teamId,
    maxPeopleOffPerDay: payload.maxPeopleOffPerDay,
    minNoticeDays: payload.minNoticeDays,
    effectiveFrom: payload.effectiveFrom,
    effectiveTo: payload.effectiveTo ?? null,
    createdBy: "demo-manager",
    createdAt: new Date().toISOString(),
  };
}

export async function getMyTeamPolicy(): Promise<TeamPolicyOut> {
  await delay(200);
  return {
    id: 1,
    teamId: "demo-team",
    maxPeopleOffPerDay: 2,
    minNoticeDays: 10,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: null,
    createdBy: "demo-manager",
    createdAt: new Date().toISOString(),
  };
}

export async function getTeamPolicyOnboardingQuestions(): Promise<TeamPolicyOnboardingQuestionsResponse> {
  await delay(220);
  return {
    teamId: "demo-team",
    hasActivePolicy: false,
    questions: [
      "¿Cuántas personas pueden estar fuera el mismo día en tu equipo?",
      "¿Cuántos días mínimos de anticipación necesitas para solicitar vacaciones?",
      "¿Desde qué fecha quieres aplicar esta política?",
    ],
  };
}

export async function runTeamPolicyAgent(
  payload: TeamPolicyAgentRequestPayload
): Promise<TeamPolicyAgentResponse> {
  await delay(300);
  const instruction = payload.instruction.toLowerCase();
  const capacity = instruction.includes("3") ? 3 : 2;
  const notice = instruction.includes("15") ? 15 : 10;

  return {
    proposal: {
      teamId: payload.teamId ?? "demo-team",
      maxPeopleOffPerDay: capacity,
      minNoticeDays: notice,
      effectiveFrom: payload.effectiveFrom ?? new Date().toISOString().slice(0, 10),
      effectiveTo: payload.effectiveTo ?? null,
      confidence: "medium",
      notes: ["Propuesta generada en modo mock para demo de onboarding agéntico."],
    },
    applied: payload.apply,
    message: payload.apply
      ? "Política aplicada (mock)."
      : "Propuesta generada (mock). Envía apply=true para aplicar.",
    policy: payload.apply
      ? {
          id: 2,
          teamId: payload.teamId ?? "demo-team",
          maxPeopleOffPerDay: capacity,
          minNoticeDays: notice,
          effectiveFrom: payload.effectiveFrom ?? new Date().toISOString().slice(0, 10),
          effectiveTo: payload.effectiveTo ?? null,
          createdBy: "demo-manager",
          createdAt: new Date().toISOString(),
        }
      : null,
  };
}

// ── Day Rollover ──────────────────────────────────────
export async function triggerRollover(
  fromYear: number,
  maxCarryoverDays: number = 10
): Promise<RolloverResult> {
  await delay(500);
  const toYear = fromYear + 1;
  const oldBalances = db.listBalances(fromYear);
  let count = 0;

  for (const oldBal of oldBalances) {
    const carry = Math.min(oldBal.availableDays, maxCarryoverDays);
    if (carry <= 0) continue;

    const existing = db.getBalance(oldBal.userId, toYear);
    if (existing) {
      db.updateBalance(oldBal.userId, toYear, {
        carriedOverDays: carry,
        availableDays: existing.availableDays + carry,
      });
    } else {
      db.upsertBalance({
        userId: oldBal.userId,
        year: toYear,
        grantedDays: 15,
        carriedOverDays: carry,
        usedDays: 0,
        availableDays: 15 + carry,
      });
    }
    count++;
  }

  return { rolledOver: count, fromYear, toYear };
}

// ── Reports (CSV) ─────────────────────────────────────
export async function exportRequestsReport(
  startDate: string,
  endDate: string
): Promise<string> {
  await delay(300);
  const allRequests = db.listAllRequests().filter(
    (r) => r.startDate >= startDate && r.endDate <= endDate
  );
  const header = "Empleado,Area,Fecha Inicio,Fecha Fin,Dias,Estado,Comentario";
  const rows = allRequests.map(
    (r) =>
      `"${r.employeeName}","${r.employeeArea}","${r.startDate}","${r.endDate}",${r.requestedBusinessDays},"${r.status}","${r.employeeComment || ""}"`
  );
  return [header, ...rows].join("\n");
}

export async function exportBalancesReport(year: number): Promise<string> {
  await delay(300);
  const bals = db.listBalances(year);
  const header = "Empleado,Area,Año,Otorgados,Arrastrados,Usados,Disponibles";
  const rows = bals.map((b) => {
    const user = db.findUserById(b.userId);
    return `"${user?.fullName ?? "—"}","${user?.area.name ?? "—"}",${b.year},${b.grantedDays},${b.carriedOverDays},${b.usedDays},${b.availableDays}`;
  });
  return [header, ...rows].join("\n");
}

// ── Expenses / Viáticos (mock stubs) ────────────────────

export async function uploadReceipts(_files: File[]): Promise<ExpenseReceipt[]> {
  await delay(300);
  return [];
}

export async function listReceipts(
  _params?: { reportId?: string; unassigned?: boolean } & Partial<PaginationParams>,
): Promise<PaginatedResponse<ExpenseReceipt>> {
  await delay(200);
  return paginate([], _params);
}

export async function getReceipt(_id: string): Promise<ExpenseReceipt> {
  throw new Error("Mock: receipt not found");
}

export async function updateReceipt(_id: string, _data: Record<string, unknown>): Promise<ExpenseReceipt> {
  throw new Error("Mock: not implemented");
}

export async function createExpenseReport(_data: Record<string, unknown>): Promise<ExpenseReport> {
  throw new Error("Mock: not implemented");
}

export async function listExpenseReports(
  _params?: { status?: string } & Partial<PaginationParams>,
): Promise<PaginatedResponse<ExpenseReport>> {
  await delay(200);
  return paginate([], _params);
}

export async function getExpenseReport(_id: string): Promise<ExpenseReport> {
  throw new Error("Mock: report not found");
}

export async function submitExpenseReport(_id: string): Promise<ExpenseReport> {
  throw new Error("Mock: not implemented");
}

export async function createManualReceipt(_data: Record<string, unknown>): Promise<ExpenseReceipt> {
  throw new Error("Mock: not implemented");
}

export async function deleteReceipt(_id: string): Promise<void> {
  await delay(200);
}

export async function reExtractReceipt(_id: string): Promise<ExpenseReceipt> {
  throw new Error("Mock: not implemented");
}

export async function listFinanceReports(
  _params?: { status?: string; ownerId?: string; teamId?: string; search?: string; dateFrom?: string; dateTo?: string; includeReceipts?: boolean } & Partial<PaginationParams>,
): Promise<PaginatedResponse<ExpenseReport>> {
  await delay(200);
  return paginate([], _params);
}

export async function getFinanceReport(_id: string): Promise<ExpenseReport> {
  throw new Error("Mock: report not found");
}

export async function getExpenseAnalytics(): Promise<import("@/api/real/client").ExpenseAnalytics> {
  await delay(200);
  return { totalReports: 0, totalReceipts: 0, totalAmount: 0, totalTax: 0, byStatus: {}, byCategory: {}, byMonth: [], topVendors: [] };
}

export async function approveReport(_id: string, _comment?: string): Promise<ExpenseReport> {
  throw new Error("Mock: not implemented");
}

export async function rejectReport(_id: string, _comment?: string): Promise<ExpenseReport> {
  throw new Error("Mock: not implemented");
}

export async function needsChangesReport(_id: string, _comment?: string): Promise<ExpenseReport> {
  throw new Error("Mock: not implemented");
}

export function exportReportUrl(_id: string): string {
  return "#";
}

export async function decideReceipt(_reportId: string, _receiptId: string, _decision: string, _comment?: string): Promise<unknown> {
  throw new Error("Mock: not implemented");
}

export async function finalizeReview(_reportId: string, _comment?: string): Promise<ExpenseReport> {
  throw new Error("Mock: not implemented");
}

export async function resetReceiptDecisions(_reportId: string): Promise<ExpenseReport> {
  throw new Error("Mock: not implemented");
}

export async function markReportPaid(_reportId: string, _file?: File): Promise<ExpenseReport> {
  throw new Error("Mock: not implemented");
}

export function paymentProofUrl(_id: string): string {
  return "#";
}

// ── Conflict Analysis (mock) ──────────────────────────
export async function analyzeConflict(_requestId: string): Promise<import("@/types").ConflictAnalysis> {
  await delay(300);
  return {
    request_id: _requestId,
    requester_name: "Empleado Mock",
    risk_level: "LOW",
    team_size: 5,
    days_requested: 3,
    daily_analysis: [],
    overlapping_requests: [],
    worst_day: null,
    summary: "🟢 Sin conflictos significativos (mock).",
    ai_recommendation: {
      recommendation: "Se recomienda aprobar la solicitud. No hay conflictos con el equipo.",
      key_concerns: [],
      suggested_actions: [],
    },
    ai_powered: true,
  };
}

export async function suggestDates(_desiredDays: number, _searchMonths?: number): Promise<import("@/types").DateSuggestionsResponse> {
  await delay(300);
  return {
    policy_info: {
      min_notice_days: 10,
      max_people_off_per_day: 2,
      team_size: 5,
      earliest_allowed_date: "2026-04-10",
    },
    suggestions: [],
    ai_powered: false,
  };
}

export async function exportICS(_requestId: string): Promise<string> {
  await delay(100);
  return "BEGIN:VCALENDAR\nEND:VCALENDAR";
}

// ── Profile ───────────────────────────────────────────
export async function getMyProfile(): Promise<{ phone: string | null; emergency_contact: string | null }> {
  await delay(200);
  return { phone: null, emergency_contact: null };
}

export async function updateMyProfile(data: { phone?: string | null; emergency_contact?: string | null }): Promise<{ phone: string | null; emergency_contact: string | null; message: string }> {
  await delay(300);
  return { phone: data.phone ?? null, emergency_contact: data.emergency_contact ?? null, message: "Perfil actualizado correctamente." };
}

export async function getMyTeamInfo(): Promise<import("@/types").TeamInfo> {
  await delay(300);
  return { manager: null, team_members: [], on_vacation_now: [], upcoming_vacations: [] };
}

// ── Bulk Import ──────────────────────────────────────
export async function downloadImportTemplate(): Promise<void> {
  await delay(200);
  alert("[Mock] Plantilla descargada (mock).");
}

export async function previewImport(_file: File): Promise<import("@/api/real/client").BulkPreviewResponse> {
  await delay(500);
  return {
    valid: 2,
    errors: 1,
    total: 3,
    results: [
      { row: 2, name: "Juan Pérez", email: "juanp@seekop.com", role: "EMPLOYEE", team: "Desarrollo", vacation_days: 12, status: "VÁLIDO", detail: "Listo para importar — 12 días de vacaciones" },
      { row: 3, name: "María López", email: "marial@seekop.com", role: "MANAGER", team: "Diseño", vacation_days: 14, status: "VÁLIDO", detail: "Listo para importar — 14 días de vacaciones" },
      { row: 4, name: "Pedro Ruiz", email: "pedror@seekop.com", role: "EMPLOYEE", team: "Ventas", status: "ERROR", detail: "equipo no encontrado: Ventas" },
    ],
  };
}

export async function importEmployees(_file: File): Promise<import("@/api/real/client").BulkImportResponse> {
  await delay(500);
  return {
    created: 2,
    errors: 1,
    total: 3,
    results: [
      { row: 2, name: "Juan Pérez", email: "juanp@seekop.com", role: "EMPLOYEE", team: "Desarrollo", password: "Skp-Juan123!", vacation_days: 12, status: "CREADO", detail: "Antigüedad: 1 año(s). Días otorgados: 12." },
      { row: 3, name: "María López", email: "marial@seekop.com", role: "MANAGER", team: "Diseño", password: "Skp-Mari456@", vacation_days: 14, status: "CREADO", detail: "Antigüedad: 2 año(s). Días otorgados: 14." },
      { row: 4, name: "Pedro Ruiz", email: "pedror@seekop.com", role: "EMPLOYEE", team: "Ventas", status: "ERROR", detail: "equipo no encontrado: Ventas" },
    ],
    result_file_b64: "",
    batch_id: "mock-batch-id",
  };
}

export async function rollbackImport(_batchId: string): Promise<import("@/api/real/client").BulkRollbackResponse> {
  await delay(300);
  return { rolled_back: 2, emails: ["juanp@seekop.com", "marial@seekop.com"], detail: "Se desactivaron 2 usuario(s) del lote mock…" };
}
