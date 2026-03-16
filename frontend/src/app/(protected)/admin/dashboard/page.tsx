"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import api from "@/api/client";
import type { VacationRequest, UserFilters, RequestFilters, UserRole, RequestStatus, AuditLogEntry } from "@/types";
import RoleGuard from "@/components/layout/RoleGuard";
import Tabs from "@/components/ui/Tabs";
import Table, { type Column } from "@/components/ui/Table";
import { StatusBadge, RoleBadge } from "@/components/ui/Badge";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import RequestsTable from "@/components/vacations/RequestsTable";
import ApprovalModal from "@/components/vacations/ApprovalModal";
import { RequestFiltersBar, UserFiltersBar } from "@/components/vacations/Filters";
import { formatDate } from "@/lib/format";
import type { VacationBalance } from "@/types";
import AIChatPanel from "@/components/ai/AIChatPanel";
import { useToast } from "@/components/ui/Toast";
import ExportBar from "@/components/reports/ExportBar";
import { downloadCSV, printAsPDF } from "@/lib/export";
import { Shield, LogIn, UserPlus, UserMinus, Edit, Key, ClipboardCheck, XCircle, Ban, FileText } from "lucide-react";

type ModalAction = "approve" | "reject";

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();

  // ── Users tab state ──
  const [userRole, setUserRole] = useState("");
  const [userArea, setUserArea] = useState("");
  const [userSearch, setUserSearch] = useState("");

  // ── Requests tab state ──
  const [reqStatus, setReqStatus] = useState("");
  const [reqArea, setReqArea] = useState("");
  const [reqStart, setReqStart] = useState("");
  const [reqEnd, setReqEnd] = useState("");

  // ── Balances tab state ──
  const [balYear, setBalYear] = useState(currentYear);

  // ── Audit log state ──
  const [auditAction, setAuditAction] = useState("");

  // ── Approval modal ──
  const [selectedReq, setSelectedReq] = useState<VacationRequest | null>(null);
  const [modalAction, setModalAction] = useState<ModalAction>("approve");
  const [modalOpen, setModalOpen] = useState(false);

  // ── Export state ──
  const [exporting, setExporting] = useState(false);

  // ── Queries ──
  const teamsQ = useQuery({
    queryKey: ["admin.teams"],
    queryFn: () => api.admin.teams.list(),
  });

  const areas = (teamsQ.data ?? []).map((t) => ({ id: t.id, name: t.name }));

  const usersQ = useQuery({
    queryKey: ["admin.users", userRole, userArea, userSearch],
    queryFn: async () => {
      const res = await api.admin.users.list({
        role: (userRole as UserRole) || undefined,
        areaId: userArea || undefined,
        search: userSearch || undefined,
      });
      return res.items;
    },
  });

  const requestsQ = useQuery({
    queryKey: ["admin.requests", reqStatus, reqArea, reqStart, reqEnd],
    queryFn: async () => {
      const res = await api.admin.requests.list({
        status: (reqStatus as RequestStatus) || undefined,
        areaId: reqArea || undefined,
        startDate: reqStart || undefined,
        endDate: reqEnd || undefined,
      });
      return res.items;
    },
  });

  const balancesQ = useQuery({
    queryKey: ["admin.balances", balYear],
    queryFn: async () => {
      const res = await api.admin.balances.list(balYear);
      return res.items;
    },
  });

  const auditQ = useQuery({
    queryKey: ["admin.auditLogs", auditAction],
    queryFn: async () => {
      const res = await api.admin.auditLogs.list(auditAction || undefined);
      return res.items;
    },
  });

  // ── Mutations ──
  const approveMut = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) =>
      api.approvals.approve(id, user!.id, comment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin.requests"] });
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
      qc.invalidateQueries({ queryKey: ["admin.requests"] });
      setModalOpen(false);
      setSelectedReq(null);
      toast("success", "Solicitud rechazada correctamente");
    },
    onError: (err) => {
      toast("error", err instanceof Error ? err.message : "Error al rechazar");
    },
  });

  const rolloverMut = useMutation({
    mutationFn: () => api.admin.rollover(balYear),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin.balances"] });
      toast("success", `Rollover completado: ${data.rolledOver} balances actualizados (${data.fromYear} → ${data.toYear})`);
    },
    onError: (err) => {
      toast("error", err instanceof Error ? err.message : "Error en rollover");
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

  // ── Export handlers ──
  const handleExportRequestsCSV = async () => {
    setExporting(true);
    try {
      const csv = await api.reports.exportRequests(
        reqStart || `${currentYear}-01-01`,
        reqEnd || `${currentYear}-12-31`
      );
      downloadCSV(csv, `solicitudes_${reqStart || currentYear}.csv`);
    } catch {
      toast("error", "Error al exportar solicitudes");
    } finally {
      setExporting(false);
    }
  };

  const handleExportBalancesCSV = async () => {
    setExporting(true);
    try {
      const csv = await api.reports.exportBalances(balYear);
      downloadCSV(csv, `balances_${balYear}.csv`);
    } catch {
      toast("error", "Error al exportar balances");
    } finally {
      setExporting(false);
    }
  };

  // ── Column defs ──
  const userColumns: Column<(typeof usersQ.data extends (infer U)[] | undefined ? U : never)>[] = [
    { key: "fullName", header: "Nombre" },
    { key: "email", header: "Email" },
    { key: "role", header: "Rol", render: (row) => <RoleBadge role={row.role} /> },
    { key: "area", header: "Área", render: (row) => row.area.name },
  ];

  type BalanceRow = VacationBalance & { userName: string; userArea: string };
  const balanceColumns: Column<BalanceRow>[] = [
    { key: "userName", header: "Empleado" },
    { key: "userArea", header: "Área" },
    { key: "grantedDays", header: "Otorgados" },
    { key: "carriedOverDays", header: "Arrastrados" },
    { key: "usedDays", header: "Usados" },
    { key: "availableDays", header: "Disponibles" },
  ];

  const yearOptions = Array.from({ length: 3 }, (_, i) => {
    const y = currentYear - i;
    return { value: String(y), label: String(y) };
  });

  const ACTION_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    LOGIN_SUCCESS: { label: "Inicio de sesi\u00f3n", icon: LogIn, color: "text-emerald-600 bg-emerald-50" },
    LOGIN_FAILED: { label: "Login fallido", icon: Ban, color: "text-red-600 bg-red-50" },
    PASSWORD_CHANGED: { label: "Cambio de contrase\u00f1a", icon: Key, color: "text-blue-600 bg-blue-50" },
    USER_CREATED: { label: "Usuario creado", icon: UserPlus, color: "text-seekop-600 bg-seekop-50" },
    USER_UPDATED: { label: "Usuario editado", icon: Edit, color: "text-amber-600 bg-amber-50" },
    USER_DEACTIVATED: { label: "Usuario desactivado", icon: UserMinus, color: "text-red-600 bg-red-50" },
    REQUEST_CREATED: { label: "Solicitud creada", icon: FileText, color: "text-blue-600 bg-blue-50" },
    REQUEST_APPROVED: { label: "Solicitud aprobada", icon: ClipboardCheck, color: "text-emerald-600 bg-emerald-50" },
    REQUEST_REJECTED: { label: "Solicitud rechazada", icon: XCircle, color: "text-red-600 bg-red-50" },
    REQUEST_CANCELLED: { label: "Solicitud cancelada", icon: Ban, color: "text-gray-600 bg-gray-100" },
    TEAM_POLICY_UPDATED: { label: "Pol\u00edtica actualizada", icon: Shield, color: "text-violet-600 bg-violet-50" },
    BALANCE_ADJUSTED: { label: "Balance ajustado", icon: Edit, color: "text-amber-600 bg-amber-50" },
  };

  const auditColumns: Column<AuditLogEntry>[] = [
    {
      key: "action",
      header: "Acci\u00f3n",
      render: (row) => {
        const info = ACTION_LABELS[row.action] ?? { label: row.action, icon: FileText, color: "text-gray-600 bg-gray-100" };
        const Icon = info.icon;
        return (
          <div className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg ${info.color}`}>
              <Icon size={14} />
            </div>
            <span className="text-sm font-medium text-gray-700">{info.label}</span>
          </div>
        );
      },
    },
    {
      key: "actorName",
      header: "Usuario",
      render: (row) => (
        <span className="text-sm text-gray-600">{row.actorName ?? "Sistema"}</span>
      ),
    },
    {
      key: "entityType",
      header: "Entidad",
      render: (row) => (
        <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
          {row.entityType}:{row.entityId.slice(0, 8)}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Fecha",
      render: (row) => (
        <span className="text-sm text-gray-500">
          {new Date(row.createdAt).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </span>
      ),
    },
  ];

  const auditFilterOptions = [
    { value: "", label: "Todas las acciones" },
    { value: "LOGIN_SUCCESS", label: "Inicios de sesi\u00f3n" },
    { value: "LOGIN_FAILED", label: "Logins fallidos" },
    { value: "USER_CREATED", label: "Usuarios creados" },
    { value: "USER_UPDATED", label: "Usuarios editados" },
    { value: "USER_DEACTIVATED", label: "Usuarios desactivados" },
    { value: "REQUEST_CREATED", label: "Solicitudes creadas" },
    { value: "REQUEST_APPROVED", label: "Solicitudes aprobadas" },
    { value: "REQUEST_REJECTED", label: "Solicitudes rechazadas" },
    { value: "PASSWORD_CHANGED", label: "Cambios de contrase\u00f1a" },
  ];

  const tabs = [
    {
      id: "users",
      label: "Usuarios",
      content: (
        <div className="space-y-4">
          <UserFiltersBar
            role={userRole}
            areaId={userArea}
            search={userSearch}
            areas={areas}
            onRoleChange={setUserRole}
            onAreaChange={setUserArea}
            onSearchChange={setUserSearch}
          />
          <Table columns={userColumns} data={usersQ.data ?? []} isLoading={usersQ.isLoading} isError={usersQ.isError} errorMessage="Error al cargar usuarios." onRetry={() => void usersQ.refetch()} emptyMessage="No se encontraron usuarios." />
        </div>
      ),
    },
    {
      id: "requests",
      label: "Solicitudes",
      content: (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <RequestFiltersBar
              status={reqStatus}
              areaId={reqArea}
              startDate={reqStart}
              endDate={reqEnd}
              areas={areas}
              onStatusChange={setReqStatus}
              onAreaChange={setReqArea}
              onStartDateChange={setReqStart}
              onEndDateChange={setReqEnd}
            />
            <ExportBar
              onExportCSV={handleExportRequestsCSV}
              onPrintPDF={printAsPDF}
              loading={exporting}
            />
          </div>
          <RequestsTable
            data={requestsQ.data ?? []}
            isLoading={requestsQ.isLoading}
            showEmployee
            showActions
            onApprove={(req) => openModal(req, "approve")}
            onReject={(req) => openModal(req, "reject")}
            emptyMessage="No se encontraron solicitudes."
          />
        </div>
      ),
    },
    {
      id: "audit",
      label: "Audit Log",
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Shield size={18} className="text-gray-500" />
            <h3 className="text-sm font-semibold text-seekop-700">Registro de actividad del sistema</h3>
            <div className="ml-auto w-56">
              <Select
                value={auditAction}
                onChange={(e) => setAuditAction(e.target.value)}
                options={auditFilterOptions}
              />
            </div>
          </div>
          <Table
            columns={auditColumns}
            data={auditQ.data ?? []}
            isLoading={auditQ.isLoading}
            emptyMessage="No hay registros de actividad."
          />
        </div>
      ),
    },
    {
      id: "balances",
      label: "Balances",
      content: (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div className="w-40">
              <Select
                label="Año"
                value={String(balYear)}
                onChange={(e) => setBalYear(Number(e.target.value))}
                options={yearOptions}
              />
            </div>
            <div className="flex gap-2 items-end">
              <ExportBar
                onExportCSV={handleExportBalancesCSV}
                onPrintPDF={printAsPDF}
                loading={exporting}
              />
              <Button
                variant="success"
                size="sm"
                onClick={() => rolloverMut.mutate()}
                loading={rolloverMut.isPending}
              >
                Rollover {balYear} → {balYear + 1}
              </Button>
            </div>
          </div>
          <Table columns={balanceColumns} data={(balancesQ.data ?? []) as BalanceRow[]} isLoading={balancesQ.isLoading} isError={balancesQ.isError} errorMessage="Error al cargar balances." onRetry={() => void balancesQ.refetch()} emptyMessage="No hay balances para este año." />
        </div>
      ),
    },
  ];

  return (
    <RoleGuard allowed={["ADMIN"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Panel de Administración</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestión global de usuarios, solicitudes y balances
          </p>
        </div>

        <Tabs tabs={tabs} defaultTab="users" />

        <AIChatPanel title="Asistente IA (Admin)" />

        <ApprovalModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setSelectedReq(null); }}
          request={selectedReq}
          action={modalAction}
          onConfirm={handleConfirm}
        />
      </div>
    </RoleGuard>
  );
}

