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
    rollover: impl.triggerRollover,
    auditLogs: { list: impl.listAuditLogs },
  },
  reports: {
    exportRequests: impl.exportRequestsReport,
    exportBalances: impl.exportBalancesReport,
  },
  manager: {
    teamMembers: impl.listTeamMembers,
    teamHistory: impl.listTeamHistory,
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
  expenses: {
    uploadReceipts: impl.uploadReceipts,
    listReceipts: impl.listReceipts,
    getReceipt: impl.getReceipt,
    updateReceipt: impl.updateReceipt,
    createManualReceipt: impl.createManualReceipt,
    deleteReceipt: impl.deleteReceipt,
    reExtractReceipt: impl.reExtractReceipt,
    createReport: impl.createExpenseReport,
    listReports: impl.listExpenseReports,
    getReport: impl.getExpenseReport,
    submitReport: impl.submitExpenseReport,
  },
  finance: {
    listReports: impl.listFinanceReports,
    getReport: impl.getFinanceReport,
    getAnalytics: impl.getExpenseAnalytics,
    approve: impl.approveReport,
    reject: impl.rejectReport,
    needsChanges: impl.needsChangesReport,
    exportReportUrl: impl.exportReportUrl,
    decideReceipt: impl.decideReceipt,
    finalizeReview: impl.finalizeReview,
    resetReceiptDecisions: impl.resetReceiptDecisions,
    markReportPaid: impl.markReportPaid,
    paymentProofUrl: impl.paymentProofUrl,
  },
};

export default api;
