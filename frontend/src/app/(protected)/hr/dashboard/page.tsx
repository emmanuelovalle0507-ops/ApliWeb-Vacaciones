"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Pencil, UserX, AlertTriangle, Users, FileText, BarChart3 } from "lucide-react";
import api from "@/api/client";
import type { User, UserRole, RequestStatus, VacationBalance, UserCreatePayload, UserUpdatePayload } from "@/types";
import RoleGuard from "@/components/layout/RoleGuard";
import Tabs from "@/components/ui/Tabs";
import Table, { type Column } from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import { RoleBadge } from "@/components/ui/Badge";
import Select from "@/components/ui/Select";
import RequestsTable from "@/components/vacations/RequestsTable";
import { RequestFiltersBar, UserFiltersBar } from "@/components/vacations/Filters";
import AIChatPanel from "@/components/ai/AIChatPanel";
import { useToast } from "@/components/ui/Toast";
import ExportBar from "@/components/reports/ExportBar";
import { downloadCSV, printAsPDF } from "@/lib/export";
import UserFormModal from "@/components/users/UserFormModal";
import UserCreatedModal from "@/components/users/UserCreatedModal";
import { useAuth } from "@/providers/AuthProvider";

/* ── Helpers ── */
const AVATAR_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-pink-500",
];

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function HRDashboardPage() {
  const currentYear = new Date().getFullYear();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const isHR = currentUser?.role === "HR";

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

  // ── Export state ──
  const [exporting, setExporting] = useState(false);

  // ── User CRUD state ──
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null);
  const [createdCreds, setCreatedCreds] = useState<{
    name: string; email: string; password: string; emailSent: boolean;
  } | null>(null);

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

  // ── Mutations ──
  const [lastCreatePayload, setLastCreatePayload] = useState<UserCreatePayload | null>(null);
  const createMutation = useMutation({
    mutationFn: (payload: UserCreatePayload) => {
      setLastCreatePayload(payload);
      return api.admin.users.create(payload);
    },
    onSuccess: (_data) => {
      queryClient.invalidateQueries({ queryKey: ["admin.users"] });
      setShowCreateModal(false);
      if (lastCreatePayload) {
        setCreatedCreds({
          name: lastCreatePayload.fullName,
          email: lastCreatePayload.email,
          password: lastCreatePayload.password,
          emailSent: false,
        });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: UserUpdatePayload }) =>
      api.admin.users.update(userId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin.users"] });
      setEditUser(null);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (userId: string) => api.admin.users.deactivate(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin.users"] });
      setDeactivateTarget(null);
    },
  });

  // ── Managers list (for the form) ──
  const managerCandidates = (usersQ.data ?? []).filter(
    (u) => (u.role === "MANAGER" || u.role === "ADMIN") && u.isActive !== false
  );

  // ── Column defs ──
  const userColumns: Column<User>[] = [
    {
      key: "fullName",
      header: "Empleado",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-bold shrink-0 ${avatarColor(row.id)}`}>
            {getInitials(row.fullName)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{row.fullName}</p>
            <p className="text-xs text-gray-400 truncate">{row.email}</p>
          </div>
        </div>
      ),
    },
    { key: "role", header: "Rol", render: (row) => <RoleBadge role={row.role} /> },
    {
      key: "area",
      header: "Equipo",
      render: (row) => (
        <span className="text-sm text-gray-600">{row.area.name}</span>
      ),
    },
    {
      key: "position",
      header: "Puesto",
      render: (row) => (
        <span className="text-sm text-gray-500">{row.position || <span className="text-gray-300">Sin asignar</span>}</span>
      ),
    },
    {
      key: "isActive",
      header: "Estado",
      render: (row) =>
        row.isActive === false ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-100 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            Inactivo
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Activo
          </span>
        ),
    },
    {
      key: "id",
      header: "",
      render: (row) => {
        const isAdminTarget = row.role === "ADMIN";
        const blocked = isHR && isAdminTarget;
        return (
          <div className="flex items-center gap-0.5 justify-end">
            {!blocked && (
              <button
                onClick={() => setEditUser(row)}
                className="p-2 text-gray-400 hover:text-seekop-600 hover:bg-seekop-50 rounded-xl transition-all duration-200"
                title="Editar empleado"
              >
                <Pencil size={15} />
              </button>
            )}
            {row.isActive !== false && !blocked && (
              <button
                onClick={() => setDeactivateTarget(row)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200"
                title="Desactivar empleado"
              >
                <UserX size={15} />
              </button>
            )}
          </div>
        );
      },
    },
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

  const activeCount = (usersQ.data ?? []).filter((u) => u.isActive !== false).length;
  const totalCount = (usersQ.data ?? []).length;

  const tabs = [
    {
      id: "users",
      label: "Empleados",
      content: (
        <div className="space-y-5">
          {/* Stats bar */}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-gray-500"><span className="font-semibold text-gray-700">{activeCount}</span> activos</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-300" />
              <span className="text-gray-500"><span className="font-semibold text-gray-700">{totalCount - activeCount}</span> inactivos</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-gray-500"><span className="font-semibold text-gray-700">{totalCount}</span> total</span>
            </div>
          </div>

          <div className="flex items-end justify-between gap-4 flex-wrap">
            <UserFiltersBar
              role={userRole}
              areaId={userArea}
              search={userSearch}
              areas={areas}
              onRoleChange={setUserRole}
              onAreaChange={setUserArea}
              onSearchChange={setUserSearch}
            />
            <Button onClick={() => setShowCreateModal(true)} className="shrink-0 shadow-sm">
              <UserPlus size={16} className="mr-2" />
              Registrar empleado
            </Button>
          </div>

          <Table
            columns={userColumns}
            data={usersQ.data ?? []}
            isLoading={usersQ.isLoading}
            isError={usersQ.isError}
            errorMessage="Error al cargar usuarios."
            onRetry={() => void usersQ.refetch()}
            emptyMessage="No se encontraron usuarios con los filtros seleccionados."
          />
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
            showActions={false}
            emptyMessage="No se encontraron solicitudes."
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
            <ExportBar
              onExportCSV={handleExportBalancesCSV}
              onPrintPDF={printAsPDF}
              loading={exporting}
            />
          </div>
          <Table columns={balanceColumns} data={(balancesQ.data ?? []) as BalanceRow[]} isLoading={balancesQ.isLoading} isError={balancesQ.isError} errorMessage="Error al cargar balances." onRetry={() => void balancesQ.refetch()} emptyMessage="No hay balances para este año." />
        </div>
      ),
    },
  ];

  return (
    <RoleGuard allowed={["HR"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Recursos Humanos</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Gestión de empleados, solicitudes y balances de vacaciones
            </p>
          </div>
        </div>

        <Tabs tabs={tabs} defaultTab="users" />

        {/* Create User Modal */}
        <UserFormModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmitCreate={async (payload) => {
            await createMutation.mutateAsync(payload);
          }}
          teams={areas}
          managers={managerCandidates}
          allowedRoles={["EMPLOYEE", "MANAGER"]}
          loading={createMutation.isPending}
        />

        {/* Edit User Modal */}
        <UserFormModal
          open={!!editUser}
          onClose={() => setEditUser(null)}
          editUser={editUser}
          onSubmitUpdate={async (userId, payload) => {
            await updateMutation.mutateAsync({ userId, payload });
          }}
          teams={areas}
          managers={managerCandidates}
          allowedRoles={["EMPLOYEE", "MANAGER"]}
          loading={updateMutation.isPending}
        />

        {/* Deactivate Confirmation */}
        {deactivateTarget && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="px-6 pt-6 pb-4 text-center">
                <div className="mx-auto flex items-center justify-center w-14 h-14 rounded-full bg-red-50 mb-4">
                  <AlertTriangle size={28} className="text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Desactivar empleado</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  ¿Estás seguro de desactivar a{" "}
                  <span className="font-semibold text-gray-800">{deactivateTarget.fullName}</span>?
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  El empleado perderá acceso al sistema de inmediato. Esta acción se puede revertir.
                </p>
              </div>
              <div className="flex gap-3 px-6 py-4 bg-gray-50/50 border-t border-gray-100">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setDeactivateTarget(null)}
                  disabled={deactivateMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  loading={deactivateMutation.isPending}
                  onClick={() => deactivateMutation.mutate(deactivateTarget.id)}
                >
                  Sí, desactivar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* User Created Success Modal */}
        {createdCreds && (
          <UserCreatedModal
            open={!!createdCreds}
            onClose={() => setCreatedCreds(null)}
            employeeName={createdCreds.name}
            employeeEmail={createdCreds.email}
            tempPassword={createdCreds.password}
            emailSent={createdCreds.emailSent}
          />
        )}

        <AIChatPanel title="Asistente IA (RH)" />
      </div>
    </RoleGuard>
  );
}
