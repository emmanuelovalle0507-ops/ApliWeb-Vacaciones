// ── Enums ──────────────────────────────────────────────
export type UserRole = "EMPLOYEE" | "MANAGER" | "ADMIN" | "HR" | "FINANCE";
export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELED";
export type NotificationType =
  | "REQUEST_CREATED"
  | "REQUEST_APPROVED"
  | "REQUEST_REJECTED"
  | "REQUEST_CANCELLED"
  | "POLICY_UPDATED";
export type EmailStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED";

export const USER_ROLES: UserRole[] = ["EMPLOYEE", "MANAGER", "ADMIN", "HR", "FINANCE"];
export const REQUEST_STATUSES: RequestStatus[] = ["PENDING", "APPROVED", "REJECTED", "CANCELED"];

export const ROLE_LABELS: Record<UserRole, string> = {
  EMPLOYEE: "Empleado",
  MANAGER: "Manager",
  ADMIN: "Administrador",
  HR: "Recursos Humanos",
  FINANCE: "Finanzas",
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

export interface RolloverResult {
  rolledOver: number;
  fromYear: number;
  toYear: number;
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

// ── Audit Log ─────────────────────────────────────────
export interface AuditLogEntry {
  id: number;
  actorUserId: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ── Conflict Analysis ─────────────────────────────────
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface DailyConflict {
  date: string;
  date_label: string;
  occupied_current: number;
  occupied_if_approved: number;
  off_names: string[];
  max_allowed_off: number;
  available_slots: number;
  coverage_pct: number;
  exceeds_policy: boolean;
}

export interface OverlappingRequest {
  employee_name: string;
  start_date: string;
  end_date: string;
  days: number;
}

export interface AIRecommendation {
  recommendation: string;
  key_concerns: string[];
  suggested_actions: string[];
  jira_concerns?: string[];
}

export interface JiraIssue {
  key: string;
  summary: string;
  status: string;
  priority: string;
  priority_raw: string;
  due_date: string | null;
  sprint: string | null;
  project: string;
  url: string;
  type: string;
}

export interface JiraData {
  configured: boolean;
  success: boolean;
  total: number;
  issues: JiraIssue[];
  high_priority_count: number;
  due_during_period: number;
  error: string | null;
}

export interface ConflictAnalysis {
  request_id: string;
  requester_name: string;
  risk_level: RiskLevel;
  team_size: number;
  days_requested: number;
  daily_analysis: DailyConflict[];
  overlapping_requests: OverlappingRequest[];
  worst_day: DailyConflict | null;
  summary: string;
  ai_recommendation: AIRecommendation | null;
  ai_powered: boolean;
  jira?: JiraData | null;
}

export interface DateSuggestion {
  start_date: string;
  end_date: string;
  days: number;
  min_coverage_pct: number;
  max_coverage_pct: number;
  avg_coverage_pct: number;
  exceeds_policy: boolean;
  has_bridge: boolean;
  bridge_before?: number;
  bridge_after?: number;
  real_rest_days?: number;
  holidays_in_range?: string[];
  colleagues_off?: string[];
  notice_days: number;
  score?: number;
  ai_explanation?: string;
  ai_pros?: string[];
  ai_cons?: string[];
}

export interface PolicyInfo {
  min_notice_days: number;
  max_people_off_per_day: number;
  team_size: number;
  earliest_allowed_date: string;
  search_horizon_days?: number;
}

export interface BalanceInfo {
  available_days: number;
  requested_days: number;
  flexible_days: number;
}

export interface DateSuggestionsResponse {
  policy_info: PolicyInfo;
  balance_info?: BalanceInfo;
  suggestions: DateSuggestion[];
  ai_powered: boolean;
}

export interface SuggestDatesParams {
  desiredDays: number;
  searchMonths?: number;
  preferBridges?: boolean;
  earliestStartDate?: string;
  flexibleDays?: number;
}

// ── Profile / Team Info ─────────────────────────────────
export interface TeamMemberInfo {
  id: string;
  full_name: string;
  email: string;
  position: string | null;
  role: string;
}

export interface VacationPersonInfo {
  id: string;
  full_name: string;
  start_date: string;
  end_date: string;
}

export interface TeamInfo {
  manager: TeamMemberInfo | null;
  team_members: TeamMemberInfo[];
  on_vacation_now: VacationPersonInfo[];
  upcoming_vacations: VacationPersonInfo[];
}

// ── Announcements ─────────────────────────────────────
export type AnnouncementType = "GENERAL" | "URGENT" | "CELEBRATION" | "NEW_EMPLOYEE";
export type AnnouncementStatus = "DRAFT" | "PENDING_APPROVAL" | "PUBLISHED" | "ARCHIVED";

export interface ReactionSummary {
  emoji: string;
  count: number;
  userNames: string[];
}

export interface Announcement {
  id: string;
  authorId: string | null;
  authorName: string | null;
  type: AnnouncementType;
  title: string;
  body: string;
  isPinned: boolean;
  isBroadcast: boolean;
  teamIds: string[];
  teamNames: string[];
  expiresAt: string | null;
  publishAt: string | null;
  requiresAcknowledgment: boolean;
  isAcknowledged: boolean;
  isArchived: boolean;
  status: AnnouncementStatus;
  attachmentUrl: string | null;
  attachmentName: string | null;
  imageUrl: string | null;
  isRead: boolean;
  readCount: number;
  commentCount: number;
  reactions: ReactionSummary[];
  myReactions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AnnouncementComment {
  id: string;
  announcementId: string;
  userId: string;
  userName: string | null;
  body: string;
  createdAt: string;
}

export interface AnnouncementCreatePayload {
  type: AnnouncementType;
  title: string;
  body: string;
  teamIds: string[];
  isPinned: boolean;
  expiresAt?: string;
  publishAt?: string;
  requiresAcknowledgment?: boolean;
  attachmentUrl?: string;
  attachmentName?: string;
  imageUrl?: string;
  targetUserIds?: string[];
}

export interface AnnouncementReadUser {
  userId: string;
  fullName: string;
  readAt: string | null;
}

export interface AnnouncementReadStats {
  announcementId: string;
  totalTargetUsers: number;
  readCount: number;
  readUsers: AnnouncementReadUser[];
  unreadUsers: AnnouncementReadUser[];
}

// ── Navigation ─────────────────────────────────────────
export interface NavItem {
  label: string;
  href: string;
  icon: string;
}
