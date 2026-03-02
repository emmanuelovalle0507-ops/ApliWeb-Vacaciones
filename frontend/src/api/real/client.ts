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
} from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

type BackendUserSummary = {
  id: string;
  full_name: string;
  email?: string;
  role: User["role"];
  team_id?: string | null;
  team_name?: string | null;
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
  scope: "TEAM" | "GLOBAL";
};

type BackendAIChatHistoryResponse = {
  items: Array<{
    id: number;
    question: string;
    answer: string;
    scope: "TEAM" | "GLOBAL";
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

type BackendVacationRequestList = { items: BackendVacationRequest[] };

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
  is_active: boolean;
  created_at: string;
};

type BackendUserListResponse = { items: BackendUserFull[] };
type BackendBalanceListResponse = { items: BackendBalance[] };

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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("vc_token");
      localStorage.removeItem("vc_user");
      throw new Error("Sesión inválida o expirada. Inicia sesión de nuevo.");
    }
    throw new Error(body.detail || `Error ${res.status}`);
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
  };
}

export async function logout(): Promise<void> {
  return Promise.resolve();
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

export async function listMyRequests(_userId: string): Promise<VacationRequest[]> {
  const result = await request<BackendVacationRequestList>("/vacation-requests/me");
  return result.items.map(mapRequest);
}

export async function cancelRequest(requestId: string, _userId: string): Promise<VacationRequest> {
  const req = await request<BackendVacationRequest>(`/vacation-requests/${requestId}/cancel`, {
    method: "POST",
  });
  return mapRequest(req);
}

// ── Approvals ──────────────────────────────────────────
export async function listPending(_managerId: string): Promise<VacationRequest[]> {
  const result = await request<BackendVacationRequestList>("/manager/vacation-requests/pending");
  return result.items.map(mapRequest);
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
export async function listUsers(filters?: UserFilters): Promise<User[]> {
  const params = new URLSearchParams();
  if (filters?.role) params.set("role", filters.role);
  if (filters?.areaId) params.set("team_id", filters.areaId);
  if (filters?.search) params.set("search", filters.search);
  const qs = params.toString() ? `?${params.toString()}` : "";
  const result = await request<BackendUserListResponse>(`/admin/users${qs}`);
  return result.items.map((u) => ({
    id: u.id,
    fullName: u.full_name,
    email: u.email,
    role: mapRole(u.role),
    area: { id: u.team_id ?? "no-team", name: u.team_name ?? "Sin equipo" },
    managerId: u.manager_id ?? undefined,
  }));
}

export async function listAllRequests(filters?: RequestFilters): Promise<VacationRequest[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.areaId) params.set("team_id", filters.areaId);
  if (filters?.startDate) params.set("start_date", filters.startDate);
  if (filters?.endDate) params.set("end_date", filters.endDate);
  const qs = params.toString() ? `?${params.toString()}` : "";
  const result = await request<BackendVacationRequestList>(`/admin/vacation-requests${qs}`);
  return result.items.map(mapRequest);
}

export async function listAllBalances(
  year: number
): Promise<(VacationBalance & { userName: string; userArea: string })[]> {
  const result = await request<BackendBalanceListResponse>(`/admin/vacation-balances?year=${year}`);
  return result.items.map((b) => ({
    ...mapBalance(b),
    userName: b.user_name ?? `Usuario ${b.user_id.slice(0, 8)}`,
    userArea: b.user_area ?? "—",
  }));
}

export async function listTeams(): Promise<{ id: string; name: string }[]> {
  const result = await request<BackendTeamListResponse>("/admin/teams");
  return result.items.map((t) => ({ id: t.id, name: t.name }));
}

export async function listTeamMembers(): Promise<User[]> {
  const result = await request<BackendUserListResponse>("/manager/team/members");
  return result.items.map((u) => ({
    id: u.id,
    fullName: u.full_name,
    email: u.email,
    role: mapRole(u.role),
    area: { id: u.team_id ?? "no-team", name: u.team_name ?? "Sin equipo" },
    managerId: u.manager_id ?? undefined,
  }));
}

// ── Notifications ──────────────────────────────────────
export async function listMyNotifications(_userId: string): Promise<NotificationEvent[]> {
  return [];
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
  };
}

export async function listAIChatHistory(limit = 20): Promise<AIChatHistoryItem[]> {
  const result = await request<BackendAIChatHistoryResponse>(`/ai/chat/history?limit=${limit}`);
  return result.items.map((item) => ({
    id: item.id,
    question: item.question,
    answer: item.answer,
    scope: item.scope,
    createdAt: item.created_at,
  }));
}

// ── Team Policies (Agentic Setup) ─────────────────────
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
