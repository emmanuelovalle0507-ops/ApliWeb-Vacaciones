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
} from "@/types";
import { businessDaysBetween } from "@/lib/dates";
import * as db from "./db";

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

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

export async function listMyRequests(userId: string): Promise<VacationRequest[]> {
  await delay(200);
  return db.listRequestsByUser(userId);
}

export async function cancelRequest(requestId: string, userId: string): Promise<VacationRequest> {
  await delay(300);
  const req = db.findRequestById(requestId);
  if (!req) throw new Error("Solicitud no encontrada");
  if (req.userId !== userId) throw new Error("No autorizado");
  if (req.status !== "PENDING") throw new Error("Solo se pueden cancelar solicitudes pendientes");

  const updated = db.updateRequest(requestId, { status: "CANCELED" });
  if (!updated) throw new Error("Error al cancelar");
  return updated;
}

// ── Approvals ──────────────────────────────────────────
export async function listPending(managerId: string): Promise<VacationRequest[]> {
  await delay(200);
  return db.listPendingForManager(managerId);
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

// ── Admin ──────────────────────────────────────────────
export async function listUsers(filters?: UserFilters): Promise<User[]> {
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
  return result;
}

export async function listAllRequests(filters?: RequestFilters): Promise<VacationRequest[]> {
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
  return result;
}

export async function listAllBalances(year: number): Promise<(VacationBalance & { userName: string; userArea: string })[]> {
  await delay(200);
  return db.listBalances(year).map((b) => {
    const user = db.findUserById(b.userId);
    return { ...b, userName: user?.fullName ?? "—", userArea: user?.area.name ?? "—" };
  });
}

export async function listTeams(): Promise<{ id: string; name: string }[]> {
  await delay(200);
  return db.AREAS.map((a) => ({ id: a.id, name: a.name }));
}

export async function listTeamMembers(): Promise<User[]> {
  await delay(200);
  return db.listUsers().filter((u) => u.role === "EMPLOYEE");
}

// ── Notifications ──────────────────────────────────────
export async function listMyNotifications(userId: string): Promise<NotificationEvent[]> {
  await delay(200);
  return db.listNotificationsByUser(userId);
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
