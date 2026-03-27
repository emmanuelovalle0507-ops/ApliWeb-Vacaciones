"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Users, CheckCircle, Palmtree, CalendarCheck, History, AlertTriangle, Receipt, Loader2 } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import api from "@/api/client";
import type { VacationRequest, CalendarEvent, User } from "@/types";
import RoleGuard from "@/components/layout/RoleGuard";
import Card, { CardBody } from "@/components/ui/Card";
import Tabs from "@/components/ui/Tabs";
import RequestsTable from "@/components/vacations/RequestsTable";
import ApprovalModal from "@/components/vacations/ApprovalModal";
import TeamPolicyForm from "@/components/vacations/TeamPolicyForm";
import TeamPolicyAgentPanel from "@/components/ai/TeamPolicyAgentPanel";
import AIChatPanel from "@/components/ai/AIChatPanel";
import VacationCalendar from "@/components/calendar/VacationCalendar";
import { useToast } from "@/components/ui/Toast";

type ModalAction = "approve" | "reject";

export default function ManagerDashboardPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const year = new Date().getFullYear();

  const { toast } = useToast();
  const [selectedReq, setSelectedReq] = useState<VacationRequest | null>(null);
  const [modalAction, setModalAction] = useState<ModalAction>("approve");
  const [modalOpen, setModalOpen] = useState(false);

  const pendingQ = useQuery({
    queryKey: ["pendingApprovals", user?.id],
    queryFn: async () => {
      const res = await api.approvals.listPending(user!.id);
      return res.items;
    },
    enabled: !!user,
  });

  const balanceQ = useQuery({
    queryKey: ["balance", user?.id, year],
    queryFn: () => api.balance.getMyBalance(user!.id, year),
    enabled: !!user,
  });

  const approveMut = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) =>
      api.approvals.approve(id, user!.id, comment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pendingApprovals"] });
      setModalOpen(false);
      setSelectedReq(null);
      toast("success", "Solicitud aprobada correctamente");
    },
    onError: (err) => {
      toast("error", err instanceof Error ? err.message : "Error al aprobar");
    },
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) =>
      api.approvals.reject(id, user!.id, comment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pendingApprovals"] });
      setModalOpen(false);
      setSelectedReq(null);
      toast("success", "Solicitud rechazada correctamente");
    },
    onError: (err) => {
      toast("error", err instanceof Error ? err.message : "Error al rechazar");
    },
  });

  const openModal = (req: VacationRequest, action: ModalAction) => {
    setSelectedReq(req);
    setModalAction(action);
    setModalOpen(true);
  };

  const handleConfirm = async (requestId: string, comment?: string) => {
    if (modalAction === "approve") {
      await approveMut.mutateAsync({ id: requestId, comment });
    } else {
      await rejectMut.mutateAsync({ id: requestId, comment });
    }
  };

  const teamMembersQ = useQuery({
    queryKey: ["manager.teamMembers", user?.id],
    queryFn: () => api.manager.teamMembers(),
    enabled: !!user,
  });

  const [historyFilter, setHistoryFilter] = useState<string>("");

  const historyQ = useQuery({
    queryKey: ["manager.teamHistory", user?.id, historyFilter],
    queryFn: async () => {
      const res = await api.manager.teamHistory(historyFilter || undefined);
      return res.items;
    },
    enabled: !!user,
  });

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const calendarQ = useQuery({
    queryKey: ["calendar", monthKey],
    queryFn: () => api.calendar.getEvents(monthKey),
  });

  const teamCount = teamMembersQ.data?.length ?? 0;
  const pendingCount = pendingQ.data?.length ?? 0;

  const onVacationToday = useMemo(() => {
    const events = calendarQ.data ?? [];
    return events.filter(
      (e: CalendarEvent) => e.status === "APPROVED" && e.startDate <= todayStr && e.endDate >= todayStr
    );
  }, [calendarQ.data, todayStr]);

  const tabs = [
    {
      id: "requests",
      label: `Pendientes${pendingCount > 0 ? " (" + pendingCount + ")" : ""}`,
      content: (
        <div className="space-y-4">
          <RequestsTable
            data={pendingQ.data ?? []}
            isLoading={pendingQ.isLoading}
            showEmployee
            showActions
            onApprove={(req) => openModal(req, "approve")}
            onReject={(req) => openModal(req, "reject")}
            emptyMessage="No hay solicitudes pendientes."
          />
          <ApprovalModal
            open={modalOpen}
            onClose={() => { setModalOpen(false); setSelectedReq(null); }}
            request={selectedReq}
            action={modalAction}
            onConfirm={handleConfirm}
          />
        </div>
      ),
    },
    {
      id: "history",
      label: "Historial",
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <History size={18} className="text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-700">Historial de decisiones</h3>
            <div className="ml-auto flex gap-2">
              {[
                { value: "", label: "Todas" },
                { value: "APPROVED", label: "Aprobadas" },
                { value: "REJECTED", label: "Rechazadas" },
                { value: "CANCELLED", label: "Canceladas" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setHistoryFilter(opt.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    historyFilter === opt.value
                      ? "bg-seekop-500 text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-seekop-50 hover:text-seekop-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <RequestsTable
            data={historyQ.data ?? []}
            isLoading={historyQ.isLoading}
            showEmployee
            readOnly
            emptyMessage="No hay solicitudes en el historial."
          />
        </div>
      ),
    },
    {
      id: "policies",
      label: "Políticas de Equipo",
      content: (
        <div className="space-y-6">
          <TeamPolicyForm />
          <TeamPolicyAgentPanel title="Configurar Política con IA" />
        </div>
      ),
    },
    {
      id: "team",
      label: `Equipo (${teamCount})`,
      content: <TeamMembersPanel members={teamMembersQ.data ?? []} isLoading={teamMembersQ.isLoading} />,
    },
    {
      id: "calendar",
      label: "Calendario",
      content: <VacationCalendar title="Calendario del Equipo" />,
    },
    {
      id: "ai",
      label: "Asistente IA",
      content: <AIChatPanel title="Asistente IA (Manager)" />,
    },
  ];

  return (
    <RoleGuard allowed={["MANAGER"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard de Manager</h1>
          <p className="text-sm text-gray-500 mt-1">Gestiona las solicitudes y políticas de tu equipo</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardBody className="flex items-start gap-4">
              <div className="p-2.5 rounded-lg text-amber-600 bg-amber-50 relative">
                <ClipboardList size={22} />
                {pendingCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-red-500 text-white rounded-full animate-pulse">
                    {pendingCount}
                  </span>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pendientes</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{pendingCount}</p>
                <p className="text-xs text-gray-400">requieren tu aprobación</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-start gap-4">
              <div className="p-2.5 rounded-lg text-seekop-600 bg-seekop-50">
                <Users size={22} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Equipo</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{teamCount}</p>
                <p className="text-xs text-gray-400">miembros</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-start gap-4">
              <div className="p-2.5 rounded-lg text-emerald-600 bg-emerald-50">
                <CheckCircle size={22} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Mis Días</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{balanceQ.data?.availableDays ?? 0}</p>
                <p className="text-xs text-gray-400">disponibles</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-start gap-4">
              <div className={`p-2.5 rounded-lg ${onVacationToday.length > 0 ? "text-violet-600 bg-violet-50" : "text-gray-400 bg-gray-50"}`}>
                <Palmtree size={22} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">De vacaciones hoy</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{onVacationToday.length}</p>
                <p className="text-xs text-gray-400">
                  {onVacationToday.length > 0
                    ? onVacationToday.map((e: CalendarEvent) => e.employeeName.split(" ")[0]).join(", ")
                    : "nadie ausente"}
                </p>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Tabs: Solicitudes | Políticas | IA */}
        <Tabs tabs={tabs} defaultTab="requests" />
      </div>
    </RoleGuard>
  );
}

/* ── Team Members Panel with Expenses Toggle ──────────────── */
function TeamMembersPanel({ members, isLoading }: { members: User[]; isLoading: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const toggleMut = useMutation({
    mutationFn: (userId: string) => api.manager.toggleEmployeeExpenses(userId),
    onSuccess: (_data, userId) => {
      qc.invalidateQueries({ queryKey: ["manager.teamMembers"] });
      const member = members.find((m) => m.id === userId);
      const newState = !member?.expensesEnabled;
      toast("success", newState ? "Módulo de gastos activado." : "Módulo de gastos desactivado.");
      setTogglingId(null);
    },
    onError: (err) => {
      toast("error", err instanceof Error ? err.message : "Error al cambiar acceso.");
      setTogglingId(null);
    },
  });

  const handleToggle = (userId: string) => {
    setTogglingId(userId);
    toggleMut.mutate(userId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 size={24} className="animate-spin mr-2" /> Cargando equipo...
      </div>
    );
  }

  if (members.length === 0) {
    return <p className="text-center py-12 text-gray-400 text-sm">No tienes miembros en tu equipo.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Users size={18} className="text-gray-500" />
        <h3 className="text-sm font-semibold text-gray-700">Miembros del equipo</h3>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-seekop-100 text-seekop-700 flex items-center justify-center text-sm font-bold shrink-0">
                {m.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{m.fullName}</p>
                <p className="text-xs text-gray-400 truncate">{m.email} · {m.position || m.role}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <Receipt size={14} className={m.expensesEnabled ? "text-emerald-500" : "text-gray-300"} />
                <span className={`text-xs font-medium ${m.expensesEnabled ? "text-emerald-600" : "text-gray-400"}`}>
                  {m.expensesEnabled ? "Gastos activo" : "Gastos inactivo"}
                </span>
              </div>
              <button
                onClick={() => handleToggle(m.id)}
                disabled={togglingId === m.id}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-seekop-500 focus:ring-offset-1 ${
                  m.expensesEnabled ? "bg-emerald-500" : "bg-gray-300"
                } ${togglingId === m.id ? "opacity-50" : ""}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                    m.expensesEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-2">
        Activa el módulo de gastos para que tus empleados puedan subir tickets, facturas y enviar reportes a Finanzas.
      </p>
    </div>
  );
}
