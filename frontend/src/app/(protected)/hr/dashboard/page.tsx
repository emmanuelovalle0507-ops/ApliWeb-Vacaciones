"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/api/client";
import type { UserRole, RequestStatus, VacationBalance } from "@/types";
import RoleGuard from "@/components/layout/RoleGuard";
import Tabs from "@/components/ui/Tabs";
import Table, { type Column } from "@/components/ui/Table";
import { RoleBadge } from "@/components/ui/Badge";
import Select from "@/components/ui/Select";
import RequestsTable from "@/components/vacations/RequestsTable";
import { RequestFiltersBar, UserFiltersBar } from "@/components/vacations/Filters";
import AIChatPanel from "@/components/ai/AIChatPanel";
import { useToast } from "@/components/ui/Toast";
import ExportBar from "@/components/reports/ExportBar";
import { downloadCSV, printAsPDF } from "@/lib/export";

export default function HRDashboardPage() {
  const currentYear = new Date().getFullYear();
  const { toast } = useToast();

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

  // ── Queries ──
  const teamsQ = useQuery({
    queryKey: ["admin.teams"],
    queryFn: () => api.admin.teams.list(),
  });

  const areas = (teamsQ.data ?? []).map((t) => ({ id: t.id, name: t.name }));

  const usersQ = useQuery({
    queryKey: ["admin.users", userRole, userArea, userSearch],
    queryFn: () =>
      api.admin.users.list({
        role: (userRole as UserRole) || undefined,
        areaId: userArea || undefined,
        search: userSearch || undefined,
      }),
  });

  const requestsQ = useQuery({
    queryKey: ["admin.requests", reqStatus, reqArea, reqStart, reqEnd],
    queryFn: () =>
      api.admin.requests.list({
        status: (reqStatus as RequestStatus) || undefined,
        areaId: reqArea || undefined,
        startDate: reqStart || undefined,
        endDate: reqEnd || undefined,
      }),
  });

  const balancesQ = useQuery({
    queryKey: ["admin.balances", balYear],
    queryFn: () => api.admin.balances.list(balYear),
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
          {/* HR is read-only: no action buttons */}
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Panel de Recursos Humanos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Vista de solo lectura — usuarios, solicitudes y balances
          </p>
        </div>

        <Tabs tabs={tabs} defaultTab="users" />

        <AIChatPanel title="Asistente IA (HR — Solo lectura)" />
      </div>
    </RoleGuard>
  );
}
