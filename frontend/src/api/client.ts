/**
 * API Client Switch — consumes mock or real implementation based on env.
 * Components ALWAYS import from this file, never from mock/ or real/ directly.
 *
 * Set NEXT_PUBLIC_API_MODE=real in .env.local to switch to the real backend.
 */
import * as mockApi from "./mock/handlers";
import * as realApi from "./real/client";

const API_MODE = process.env.NEXT_PUBLIC_API_MODE || "mock";

const impl = API_MODE === "real" ? realApi : mockApi;

export const api = {
  auth: {
    login: impl.login,
    logout: impl.logout,
    changePassword: impl.changePassword,
  },
  me: {
    get: impl.getMe,
  },
  balance: {
    getMyBalance: impl.getMyBalance,
  },
  requests: {
    preValidate: impl.preValidateRequest,
    create: impl.createRequest,
    listMine: impl.listMyRequests,
    cancel: impl.cancelRequest,
  },
  approvals: {
    listPending: impl.listPending,
    approve: impl.approveRequest,
    reject: impl.rejectRequest,
  },
  admin: {
    users: {
      list: impl.listUsers,
      create: impl.createUser,
      update: impl.updateUser,
      deactivate: impl.deactivateUser,
    },
    requests: { list: impl.listAllRequests },
    balances: { list: impl.listAllBalances },
    teams: { list: impl.listTeams },
  },
  manager: {
    teamMembers: impl.listTeamMembers,
  },
  notifications: {
    listMine: impl.listMyNotifications,
    getUnreadCount: impl.getUnreadCount,
    markRead: impl.markNotificationRead,
    markAllRead: impl.markAllNotificationsRead,
  },
  calendar: {
    getEvents: impl.getCalendarEvents,
  },
  ai: {
    ask: impl.askAIChat,
    history: impl.listAIChatHistory,
  },
  teamPolicies: {
    getMy: impl.getMyTeamPolicy,
    upsert: impl.upsertTeamPolicy,
    getOnboardingQuestions: impl.getTeamPolicyOnboardingQuestions,
    runAgent: impl.runTeamPolicyAgent,
  },
};

export default api;
