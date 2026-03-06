// ── Enums ──────────────────────────────────────────────
export type UserRole = "EMPLOYEE" | "MANAGER" | "ADMIN" | "HR";
export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELED";
export type NotificationType =
  | "REQUEST_CREATED"
  | "REQUEST_APPROVED"
  | "REQUEST_REJECTED"
  | "REQUEST_CANCELLED"
  | "POLICY_UPDATED";
export type EmailStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED";

export const USER_ROLES: UserRole[] = ["EMPLOYEE", "MANAGER", "ADMIN", "HR"];
export const REQUEST_STATUSES: RequestStatus[] = ["PENDING", "APPROVED", "REJECTED", "CANCELED"];

export const ROLE_LABELS: Record<UserRole, string> = {
  EMPLOYEE: "Empleado",
  MANAGER: "Manager",
  ADMIN: "Administrador",
  HR: "Recursos Humanos",
};

export const STATUS_LABELS: Record<RequestStatus, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  CANCELED: "Cancelada",
};

// ── Domain Models ──────────────────────────────────────
export interface Area {
  id: string;
  name: string;
}

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  area: Area;
  managerId?: string;
  managerIds?: string[];
  isActive?: boolean;
  hireDate?: string;
  position?: string;
}

export interface VacationBalance {
  userId: string;
  year: number;
  grantedDays: number;
  carriedOverDays: number;
  usedDays: number;
  availableDays: number;
}

export interface VacationRequest {
  id: string;
  userId: string;
  employeeName: string;
  employeeArea: string;
  startDate: string;
  endDate: string;
  requestedBusinessDays: number;
  status: RequestStatus;
  employeeComment?: string;
  decisionBy?: string;
  decisionByName?: string;
  decisionComment?: string;
  decidedAt?: string;
  createdAt: string;
}

export interface NotificationEvent {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  isRead: boolean;
  emailStatus: EmailStatus;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  mustChangePassword?: boolean;
}

export interface AIChatHistoryItem {
  id: number;
  question: string;
  answer: string;
  scope: string;
  role?: string | null;
  toolsUsed?: string | null;
  latencyMs?: number | null;
  createdAt: string;
}

export interface AIChatAskResponse {
  answer: string;
  scope: string;
  toolResultsUsed?: string[];
  conversationId?: string | null;
}

export interface TeamPolicyOut {
  id: number;
  teamId: string;
  maxPeopleOffPerDay: number;
  minNoticeDays: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

export interface TeamPolicyOnboardingQuestionsResponse {
  teamId: string;
  hasActivePolicy: boolean;
  questions: string[];
}

export interface TeamPolicyAgentRequestPayload {
  instruction: string;
  teamId?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  apply: boolean;
}

export interface TeamPolicyAgentResponse {
  proposal: {
    teamId: string;
    maxPeopleOffPerDay: number;
    minNoticeDays: number;
    effectiveFrom: string;
    effectiveTo?: string | null;
    confidence: string;
    notes: string[];
  };
  applied: boolean;
  message: string;
  policy?: TeamPolicyOut | null;
}

// ── API Payloads ───────────────────────────────────────
export interface CreateRequestPayload {
  startDate: string;
  endDate: string;
  employeeComment?: string;
}

export interface DecisionPayload {
  comment?: string;
}

export interface UserFilters {
  role?: UserRole;
  areaId?: string;
  search?: string;
}

export interface RequestFilters {
  status?: RequestStatus;
  areaId?: string;
  startDate?: string;
  endDate?: string;
}

// ── Calendar ──────────────────────────────────────────
export interface CalendarEvent {
  requestId: string;
  employeeId: string;
  employeeName: string;
  teamId?: string;
  startDate: string;
  endDate: string;
  status: "PENDING" | "APPROVED";
}

// ── Pagination ────────────────────────────────────────
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

// ── User Management ───────────────────────────────────
export interface UserCreatePayload {
  email: string;
  fullName: string;
  role: string;
  teamId?: string;
  managerIds: string[];
  hireDate?: string;
  position?: string;
  password: string;
}

export interface UserUpdatePayload {
  fullName?: string;
  role?: string;
  teamId?: string;
  managerIds?: string[];
  hireDate?: string;
  position?: string;
  isActive?: boolean;
}

// ── Navigation ─────────────────────────────────────────
export interface NavItem {
  label: string;
  href: string;
  icon: string;
}
