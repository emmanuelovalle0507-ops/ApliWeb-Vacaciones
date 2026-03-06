/**
 * Real API client aligned with current FastAPI backend.
 */
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
  PaginatedResponse,
  PaginationMeta,
  PaginationParams,
  CalendarEvent,
  UserCreatePayload,
  UserUpdatePayload,
} from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

type BackendUserSummary = {
  id: string;
  full_name: string;
  email?: string;
  role: User["role"];
  team_id?: string | null;
  team_name?: string | null;
  must_change_password?: boolean;
};

type BackendTeamPolicy = {
  id: number;
  team_id: string;
  max_people_off_per_day: number;
  min_notice_days: number;
  effective_from: string;
  effective_to?: string | null;
  created_by?: string | null;
  created_at: string;
};

type BackendTeamPolicyOnboarding = {
  team_id: string;
  has_active_policy: boolean;
  questions: string[];
};

type BackendTeamPolicyAgentResponse = {
  proposal: {
    team_id: string;
    max_people_off_per_day: number;
    min_notice_days: number;
    effective_from: string;
    effective_to?: string | null;
    confidence: string;
    notes: string[];
  };
  applied: boolean;
  message: string;
  policy?: BackendTeamPolicy | null;
};

type BackendAIChatResponse = {
  answer: string;
  scope: string;
  tool_results_used?: string[];
  conversation_id?: string | null;
};

type BackendAIChatHistoryResponse = {
  items: Array<{
    id: number;
    question: string;
    answer: string;
    scope: string;
    role?: string | null;
    tools_used?: string | null;
    latency_ms?: number | null;
    created_at: string;
  }>;
};

type BackendLoginResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: BackendUserSummary;
};

type BackendVacationRequest = {
  id: string;
  team_id?: string | null;
  team_name?: string | null;
  employee_id: string;
  employee_name?: string | null;
  manager_id: string;
  manager_name?: string | null;
  start_date: string;
  end_date: string;
  requested_days: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reason?: string | null;
  decision_comment?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
};

type BackendPaginationMeta = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

type BackendVacationRequestList = { items: BackendVacationRequest[]; pagination: BackendPaginationMeta };

type BackendBalance = {
  user_id: string;
  user_name?: string;
  user_area?: string;
  year: number;
  available_days: number;
  used_days: number;
};

type BackendUserFull = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  team_id?: string | null;
  team_name?: string | null;
  manager_id?: string | null;
  manager_ids?: string[];
  is_active: boolean;
  hire_date?: string | null;
  position?: string | null;
  created_at: string;
};

type BackendUserListResponse = { items: BackendUserFull[]; pagination: BackendPaginationMeta };
type BackendBalanceListResponse = { items: BackendBalance[]; pagination: BackendPaginationMeta };

type BackendTeam = {
  id: string;
  name: string;
  is_active: boolean;
};

type BackendTeamListResponse = { items: BackendTeam[] };

type BackendApprovalResponse = {
  request: BackendVacationRequest;
  balance: {
    user_id: string;
    available_days: number;
    used_days: number;
  };
};

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("vc_token");
}

function mapTeamPolicy(policy: BackendTeamPolicy): TeamPolicyOut {
  return {
    id: policy.id,
    teamId: policy.team_id,
    maxPeopleOffPerDay: policy.max_people_off_per_day,
    minNoticeDays: policy.min_notice_days,
    effectiveFrom: policy.effective_from,
    effectiveTo: policy.effective_to,
    createdBy: policy.created_by,
    createdAt: policy.created_at,
  };
}

function mapRole(role: string): User["role"] {
  if (role === "EMPLOYEE" || role === "MANAGER" || role === "ADMIN" || role === "HR") return role;
  return "EMPLOYEE";
}

function mapStatus(status: BackendVacationRequest["status"]): VacationRequest["status"] {
  if (status === "CANCELLED") return "CANCELED";
  return status;
}

function mapUser(summary: BackendUserSummary, fallbackEmail = "usuario@vacaciones.local"): User {
  const teamName = summary.team_name ?? (summary.team_id ? `Team ${summary.team_id.slice(0, 8)}` : "Sin equipo");
  return {
    id: summary.id,
    fullName: summary.full_name,
    email: summary.email ?? fallbackEmail,
    role: mapRole(summary.role),
    area: {
      id: summary.team_id ?? "no-team",
      name: teamName,
    },
  };
}

function mapRequest(req: BackendVacationRequest): VacationRequest {
  return {
    id: req.id,
    userId: req.employee_id,
    employeeName: req.employee_name ?? `Empleado ${req.employee_id.slice(0, 8)}`,
    employeeArea: req.team_name ?? (req.team_id ? `Team ${req.team_id.slice(0, 8)}` : "Sin equipo"),
    startDate: req.start_date,
    endDate: req.end_date,
    requestedBusinessDays: req.requested_days,
    status: mapStatus(req.status),
    employeeComment: req.reason ?? undefined,
    decisionBy: req.manager_id,
    decisionByName: req.manager_name ?? `Manager ${req.manager_id.slice(0, 8)}`,
    decisionComment: req.decision_comment ?? undefined,
    decidedAt: req.approved_at ?? req.rejected_at ?? undefined,
    createdAt: req.created_at,
  };
}

function mapPagination(p: BackendPaginationMeta): PaginationMeta {
  return { page: p.page, pageSize: p.page_size, total: p.total, totalPages: p.total_pages };
}

function paginationQS(params?: PaginationParams): string {
  if (!params) return "";
  const parts: string[] = [];
  if (params.page) parts.push(`page=${params.page}`);
  if (params.pageSize) parts.push(`page_size=${params.pageSize}`);
  return parts.length ? parts.join("&") : "";
}

function appendQS(base: string, extra: string): string {
  if (!extra) return base;
  return base.includes("?") ? `${base}&${extra}` : `${base}?${extra}`;
}

function mapBalance(balance: BackendBalance): VacationBalance {
  const granted = Number(balance.available_days) + Number(balance.used_days);
  return {
    userId: balance.user_id,
    year: balance.year,
    grantedDays: granted,
    carriedOverDays: 0,
    usedDays: Number(balance.used_days),
    availableDays: Number(balance.available_days),
  };
}

const ERROR_MESSAGES: Record<number, string> = {
  400: "Solicitud inválida. Verifica los datos ingresados.",
  403: "No tienes permisos para realizar esta acción.",
  404: "El recurso solicitado no fue encontrado.",
  409: "Conflicto: la operación no se puede completar en el estado actual.",
  422: "Datos de entrada inválidos. Revisa los campos del formulario.",
  429: "Has realizado demasiadas solicitudes. Espera un momento.",
  500: "Error interno del servidor. Intenta de nuevo más tarde.",
  502: "El servidor no está disponible temporalmente.",
  503: "Servicio no disponible. Intenta de nuevo en unos minutos.",
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (err) {
    throw new Error("No se pudo conectar con el servidor. Verifica tu conexión a internet.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("vc_token");
      localStorage.removeItem("vc_user");
      throw new Error("Sesión inválida o expirada. Inicia sesión de nuevo.");
    }
    const detail = body.detail;
    const fallback = ERROR_MESSAGES[res.status] || `Error inesperado (${res.status})`;
    throw new Error(typeof detail === "string" ? detail : fallback);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Auth ───────────────────────────────────────────────
export async function login(email: string, password: string): Promise<AuthResponse> {
  const body = await request<BackendLoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  return {
    token: body.access_token,
    user: mapUser(body.user, email),
    mustChangePassword: body.user.must_change_password ?? false,
  };
}

export async function logout(): Promise<void> {
  return Promise.resolve();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await request("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

// ── Me ─────────────────────────────────────────────────
export async function getMe(_userId: string): Promise<User> {
  const me = await request<BackendUserSummary>("/auth/me");
  return mapUser(me);
}

// ── Balance ────────────────────────────────────────────
export async function getMyBalance(_userId: string, year: number): Promise<VacationBalance> {
  const balance = await request<BackendBalance>(`/vacation-requests/me/balance?year=${year}`);
  return mapBalance(balance);
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
  const result = await request<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    requested_days: number;
    balance_by_year: Record<number, { requested: number; available: number }>;
  }>("/vacation-requests/validate", {
    method: "POST",
    body: JSON.stringify({ start_date: startDate, end_date: endDate }),
  });
  return {
    valid: result.valid,
    errors: result.errors,
    warnings: result.warnings,
    requestedDays: result.requested_days,
    balanceByYear: result.balance_by_year,
  };
}

export async function createRequest(
  _userId: string,
  payload: CreateRequestPayload
): Promise<VacationRequest> {
  const req = await request<BackendVacationRequest>("/vacation-requests", {
    method: "POST",
    body: JSON.stringify({
      start_date: payload.startDate,
      end_date: payload.endDate,
      reason: payload.employeeComment,
    }),
  });
  return mapRequest(req);
}

export async function listMyRequests(_userId: string, pagination?: PaginationParams): Promise<PaginatedResponse<VacationRequest>> {
  const url = appendQS("/vacation-requests/me", paginationQS(pagination));
  const result = await request<BackendVacationRequestList>(url);
  return { items: result.items.map(mapRequest), pagination: mapPagination(result.pagination) };
}

export async function cancelRequest(requestId: string, _userId: string): Promise<VacationRequest> {
  const req = await request<BackendVacationRequest>(`/vacation-requests/${requestId}/cancel`, {
    method: "POST",
  });
  return mapRequest(req);
}

// ── Approvals ──────────────────────────────────────────
export async function listPending(_managerId: string, pagination?: PaginationParams): Promise<PaginatedResponse<VacationRequest>> {
  const url = appendQS("/manager/vacation-requests/pending", paginationQS(pagination));
  const result = await request<BackendVacationRequestList>(url);
  return { items: result.items.map(mapRequest), pagination: mapPagination(result.pagination) };
}

export async function approveRequest(
  requestId: string,
  _deciderId: string,
  comment?: string
): Promise<VacationRequest> {
  const result = await request<BackendApprovalResponse>(`/manager/vacation-requests/${requestId}/approve`, {
    method: "POST",
    body: JSON.stringify({ decision_comment: comment }),
  });
  return mapRequest(result.request);
}

export async function rejectRequest(
  requestId: string,
  _deciderId: string,
  comment?: string
): Promise<VacationRequest> {
  const req = await request<BackendVacationRequest>(`/manager/vacation-requests/${requestId}/reject`, {
    method: "POST",
    body: JSON.stringify({ decision_comment: comment }),
  });
  return mapRequest(req);
}

// ── Admin ──────────────────────────────────────────────
export async function listUsers(filters?: UserFilters, pagination?: PaginationParams): Promise<PaginatedResponse<User>> {
  const params = new URLSearchParams();
  if (filters?.role) params.set("role", filters.role);
  if (filters?.areaId) params.set("team_id", filters.areaId);
  if (filters?.search) params.set("search", filters.search);
  if (pagination?.page) params.set("page", String(pagination.page));
  if (pagination?.pageSize) params.set("page_size", String(pagination.pageSize));
  const qs = params.toString() ? `?${params.toString()}` : "";
  const result = await request<BackendUserListResponse>(`/admin/users${qs}`);
  return {
    items: result.items.map(mapUserFull),
    pagination: mapPagination(result.pagination),
  };
}

function mapUserFull(u: BackendUserFull): User {
  return {
    id: u.id,
    fullName: u.full_name,
    email: u.email,
    role: mapRole(u.role),
    area: { id: u.team_id ?? "no-team", name: u.team_name ?? "Sin equipo" },
    managerId: u.manager_id ?? undefined,
    managerIds: u.manager_ids ?? [],
    isActive: u.is_active,
    hireDate: u.hire_date ?? undefined,
    position: u.position ?? undefined,
  };
}

export async function createUser(payload: UserCreatePayload): Promise<User> {
  const body = {
    email: payload.email,
    full_name: payload.fullName,
    role: payload.role,
    team_id: payload.teamId || null,
    manager_ids: payload.managerIds,
    hire_date: payload.hireDate || null,
    position: payload.position || null,
    password: payload.password,
  };
  const result = await request<BackendUserFull>("/admin/users", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return mapUserFull(result);
}

export async function updateUser(userId: string, payload: UserUpdatePayload): Promise<User> {
  const body: Record<string, unknown> = {};
  if (payload.fullName !== undefined) body.full_name = payload.fullName;
  if (payload.role !== undefined) body.role = payload.role;
  if (payload.teamId !== undefined) body.team_id = payload.teamId || null;
  if (payload.managerIds !== undefined) body.manager_ids = payload.managerIds;
  if (payload.hireDate !== undefined) body.hire_date = payload.hireDate || null;
  if (payload.position !== undefined) body.position = payload.position || null;
  if (payload.isActive !== undefined) body.is_active = payload.isActive;
  const result = await request<BackendUserFull>(`/admin/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return mapUserFull(result);
}

export async function deactivateUser(userId: string): Promise<User> {
  const result = await request<BackendUserFull>(`/admin/users/${userId}/deactivate`, {
    method: "PATCH",
  });
  return mapUserFull(result);
}

export async function listAllRequests(filters?: RequestFilters, pagination?: PaginationParams): Promise<PaginatedResponse<VacationRequest>> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.areaId) params.set("team_id", filters.areaId);
  if (filters?.startDate) params.set("start_date", filters.startDate);
  if (filters?.endDate) params.set("end_date", filters.endDate);
  if (pagination?.page) params.set("page", String(pagination.page));
  if (pagination?.pageSize) params.set("page_size", String(pagination.pageSize));
  const qs = params.toString() ? `?${params.toString()}` : "";
  const result = await request<BackendVacationRequestList>(`/admin/vacation-requests${qs}`);
  return { items: result.items.map(mapRequest), pagination: mapPagination(result.pagination) };
}

export async function listAllBalances(
  year: number,
  pagination?: PaginationParams
): Promise<PaginatedResponse<VacationBalance & { userName: string; userArea: string }>> {
  const url = appendQS(`/admin/vacation-balances?year=${year}`, paginationQS(pagination));
  const result = await request<BackendBalanceListResponse>(url);
  return {
    items: result.items.map((b) => ({
      ...mapBalance(b),
      userName: b.user_name ?? `Usuario ${b.user_id.slice(0, 8)}`,
      userArea: b.user_area ?? "—",
    })),
    pagination: mapPagination(result.pagination),
  };
}

export async function listTeams(): Promise<{ id: string; name: string }[]> {
  const result = await request<BackendTeamListResponse>("/admin/teams");
  return result.items.map((t) => ({ id: t.id, name: t.name }));
}

export async function listTeamMembers(): Promise<User[]> {
  const result = await request<BackendUserListResponse>("/manager/team/members");
  return result.items.map(mapUserFull);
}

// ── Notifications ──────────────────────────────────────
interface BackendNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  email_status: string;
  created_at: string;
}

function mapNotification(n: BackendNotification): NotificationEvent {
  return {
    id: n.id,
    type: n.type as NotificationEvent["type"],
    title: n.title,
    body: n.body,
    entityType: n.entity_type ?? undefined,
    entityId: n.entity_id ?? undefined,
    isRead: n.is_read,
    emailStatus: n.email_status as NotificationEvent["emailStatus"],
    createdAt: n.created_at,
  };
}

export async function listMyNotifications(_userId: string, pagination?: PaginationParams): Promise<PaginatedResponse<NotificationEvent> & { unreadCount: number }> {
  const url = appendQS("/notifications/me", paginationQS(pagination));
  const result = await request<{ items: BackendNotification[]; unread_count: number; pagination: BackendPaginationMeta }>(url);
  return {
    items: result.items.map(mapNotification),
    unreadCount: result.unread_count,
    pagination: mapPagination(result.pagination),
  };
}

export async function getUnreadCount(): Promise<number> {
  const result = await request<{ unread_count: number }>("/notifications/me/count");
  return result.unread_count;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await request<{ ok: boolean }>(`/notifications/${notificationId}/read`, { method: "PATCH" });
}

export async function markAllNotificationsRead(): Promise<number> {
  const result = await request<{ marked_count: number }>("/notifications/me/read-all", { method: "POST" });
  return result.marked_count;
}

// ── Calendar ────────────────────────────────────────────
type BackendCalendarEvent = {
  request_id: string;
  employee_id: string;
  employee_name: string;
  team_id: string | null;
  start_date: string;
  end_date: string;
  status: string;
};

export async function getCalendarEvents(month: string, teamId?: string): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({ month });
  if (teamId) params.set("team_id", teamId);
  const result = await request<{ month: string; events: BackendCalendarEvent[] }>(`/calendar/events?${params}`);
  return result.events.map((e) => ({
    requestId: e.request_id,
    employeeId: e.employee_id,
    employeeName: e.employee_name,
    teamId: e.team_id ?? undefined,
    startDate: e.start_date,
    endDate: e.end_date,
    status: e.status as CalendarEvent["status"],
  }));
}

// ── AI Chat ─────────────────────────────────────────────
export async function askAIChat(question: string): Promise<AIChatAskResponse> {
  const result = await request<BackendAIChatResponse>("/ai/chat", {
    method: "POST",
    body: JSON.stringify({ question }),
  });

  return {
    answer: result.answer,
    scope: result.scope,
    toolResultsUsed: result.tool_results_used ?? [],
    conversationId: result.conversation_id ?? null,
  };
}

export async function listAIChatHistory(limit = 20): Promise<AIChatHistoryItem[]> {
  const result = await request<BackendAIChatHistoryResponse>(`/ai/chat/history?limit=${limit}`);
  return result.items.map((item) => ({
    id: item.id,
    question: item.question,
    answer: item.answer,
    scope: item.scope,
    role: item.role ?? null,
    toolsUsed: item.tools_used ?? null,
    latencyMs: item.latency_ms ?? null,
    createdAt: item.created_at,
  }));
}

// ── Team Policies (Agentic Setup) ─────────────────────
export async function upsertTeamPolicy(payload: {
  teamId: string;
  maxPeopleOffPerDay: number;
  minNoticeDays: number;
  effectiveFrom: string;
  effectiveTo?: string;
}): Promise<TeamPolicyOut> {
  const policy = await request<BackendTeamPolicy>("/team-policies", {
    method: "PUT",
    body: JSON.stringify({
      team_id: payload.teamId,
      max_people_off_per_day: payload.maxPeopleOffPerDay,
      min_notice_days: payload.minNoticeDays,
      effective_from: payload.effectiveFrom,
      effective_to: payload.effectiveTo ?? null,
    }),
  });
  return mapTeamPolicy(policy);
}

export async function getMyTeamPolicy(): Promise<TeamPolicyOut> {
  const policy = await request<BackendTeamPolicy>("/team-policies/me");
  return mapTeamPolicy(policy);
}

export async function getTeamPolicyOnboardingQuestions(
  teamId?: string
): Promise<TeamPolicyOnboardingQuestionsResponse> {
  const suffix = teamId ? `?team_id=${encodeURIComponent(teamId)}` : "";
  const result = await request<BackendTeamPolicyOnboarding>(`/team-policies/onboarding/questions${suffix}`);
  return {
    teamId: result.team_id,
    hasActivePolicy: result.has_active_policy,
    questions: result.questions,
  };
}

export async function runTeamPolicyAgent(
  payload: TeamPolicyAgentRequestPayload
): Promise<TeamPolicyAgentResponse> {
  const backendPayload = {
    instruction: payload.instruction,
    team_id: payload.teamId,
    effective_from: payload.effectiveFrom,
    effective_to: payload.effectiveTo,
    apply: payload.apply,
  };

  const result = await request<BackendTeamPolicyAgentResponse>("/team-policies/agent", {
    method: "POST",
    body: JSON.stringify(backendPayload),
  });

  return {
    proposal: {
      teamId: result.proposal.team_id,
      maxPeopleOffPerDay: result.proposal.max_people_off_per_day,
      minNoticeDays: result.proposal.min_notice_days,
      effectiveFrom: result.proposal.effective_from,
      effectiveTo: result.proposal.effective_to,
      confidence: result.proposal.confidence,
      notes: result.proposal.notes,
    },
    applied: result.applied,
    message: result.message,
    policy: result.policy ? mapTeamPolicy(result.policy) : null,
  };
}
