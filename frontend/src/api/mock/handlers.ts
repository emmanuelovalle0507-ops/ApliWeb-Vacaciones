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
      db.addNotification({
        id: db.genId("n"),
        userId: manager.id,
        type: "REQUEST_CREATED",
        channel: "EMAIL",
        toEmail: manager.email,
        subject: `Nueva solicitud de ${user.fullName}`,
        sendStatus: "SENT",
        sentAt: new Date().toISOString(),
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
    db.addNotification({
      id: db.genId("n"),
      userId: employee.id,
      type: "REQUEST_APPROVED",
      channel: "EMAIL",
      toEmail: employee.email,
      subject: "Tu solicitud de vacaciones fue aprobada",
      sendStatus: "SENT",
      sentAt: new Date().toISOString(),
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
    db.addNotification({
      id: db.genId("n"),
      userId: employee.id,
      type: "REQUEST_REJECTED",
      channel: "EMAIL",
      toEmail: employee.email,
      subject: "Tu solicitud de vacaciones fue rechazada",
      sendStatus: "SENT",
      sentAt: new Date().toISOString(),
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

// ── AI Chat ─────────────────────────────────────────────
export async function askAIChat(question: string): Promise<AIChatAskResponse> {
  await delay(250);
  const q = question.toLowerCase();

  if (q.includes("estado") || q.includes("resumen")) {
    return {
      answer: "Estado actual (demo): equipo con 4 empleados activos, 1 fuera hoy y 2 solicitudes pendientes.",
      scope: "TEAM",
    };
  }

  if (q.includes("siguiente mes") || q.includes("próximo mes") || q.includes("proximo mes")) {
    return {
      answer: "Próximo mes (demo): Carlos López (2026-03-10 a 2026-03-14).",
      scope: "TEAM",
    };
  }

  return {
    answer:
      "Solo puedo ayudarte con datos de la app de vacaciones (estado, disponibilidad, aprobaciones/rechazos y motivos).",
    scope: "TEAM",
  };
}

export async function listAIChatHistory(): Promise<AIChatHistoryItem[]> {
  await delay(200);
  return [
    {
      id: 1,
      question: "¿Cuál es el estado actual del equipo?",
      answer: "Estado actual (demo): equipo con 4 empleados activos, 1 fuera hoy y 2 solicitudes pendientes.",
      scope: "TEAM",
      createdAt: new Date().toISOString(),
    },
  ];
}

// ── Team Policies (Agentic Setup) ─────────────────────
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
