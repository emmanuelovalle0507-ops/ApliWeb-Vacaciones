"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusCircle } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import api from "@/api/client";
import type { CreateRequestFormData } from "@/types/schemas";
import type { VacationRequest } from "@/types";
import RoleGuard from "@/components/layout/RoleGuard";
import Button from "@/components/ui/Button";
import Card, { CardBody } from "@/components/ui/Card";
import BalanceCard from "@/components/vacations/BalanceCard";
import RequestForm from "@/components/vacations/RequestForm";
import RequestsTable from "@/components/vacations/RequestsTable";
import CancelDialog from "@/components/vacations/CancelDialog";
import EditRequestModal from "@/components/vacations/EditRequestModal";
import RequestDetailModal from "@/components/vacations/RequestDetailModal";
import VacationCalendar from "@/components/calendar/VacationCalendar";
import DateSuggestions from "@/components/vacations/DateSuggestions";
import { useToast } from "@/components/ui/Toast";

export default function EmployeeDashboardPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const year = new Date().getFullYear();

  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<VacationRequest | null>(null);
  const [editTarget, setEditTarget] = useState<VacationRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [viewTarget, setViewTarget] = useState<VacationRequest | null>(null);

  const balanceQ = useQuery({
    queryKey: ["balance", user?.id, year],
    queryFn: () => api.balance.getMyBalance(user!.id, year),
    enabled: !!user,
  });

  const requestsQ = useQuery({
    queryKey: ["myRequests", user?.id, statusFilter],
    queryFn: async () => {
      const filters = statusFilter ? { status: statusFilter } : undefined;
      const res = await api.requests.listMine(user!.id, undefined, filters);
      return res.items;
    },
    enabled: !!user,
  });

  const createMut = useMutation({
    mutationFn: (data: CreateRequestFormData) =>
      api.requests.create(user!.id, {
        startDate: data.startDate,
        endDate: data.endDate,
        employeeComment: data.employeeComment,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["myRequests"] });
      qc.invalidateQueries({ queryKey: ["balance"] });
      setShowForm(false);
      toast("success", "Solicitud creada correctamente");
    },
    onError: (err) => {
      toast("error", err instanceof Error ? err.message : "Error al crear solicitud");
    },
  });

  const editMut = useMutation({
    mutationFn: ({ requestId, payload }: { requestId: string; payload: { startDate: string; endDate: string; employeeComment?: string } }) =>
      api.requests.edit(requestId, user!.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["myRequests"] });
      qc.invalidateQueries({ queryKey: ["balance"] });
      setEditTarget(null);
      toast("success", "Solicitud editada correctamente");
    },
    onError: (err) => {
      toast("error", err instanceof Error ? err.message : "Error al editar solicitud");
    },
  });

  const cancelMut = useMutation({
    mutationFn: (requestId: string) => api.requests.cancel(requestId, user!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["myRequests"] });
      qc.invalidateQueries({ queryKey: ["balance"] });
      setCancelTarget(null);
      toast("success", "Solicitud cancelada");
    },
    onError: (err) => {
      toast("error", err instanceof Error ? err.message : "Error al cancelar");
    },
  });

  return (
    <RoleGuard allowed={["EMPLOYEE", "MANAGER"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mi Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">
              Resumen de tus vacaciones y solicitudes
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="shadow-sm">
            <PlusCircle size={18} className="mr-2" />
            {showForm ? "Cerrar formulario" : "Nueva Solicitud"}
          </Button>
        </div>

        {/* Balance */}
        <BalanceCard balance={balanceQ.data ?? null} isLoading={balanceQ.isLoading} />

        {/* Request form */}
        {showForm && (
          <Card>
            <CardBody>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Nueva Solicitud de Vacaciones
              </h2>
              <RequestForm
                availableDays={balanceQ.data?.availableDays ?? 0}
                onSubmit={async (data) => {
                  await createMut.mutateAsync(data);
                }}
                onCancel={() => setShowForm(false)}
              />
              {createMut.error && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">
                    {createMut.error instanceof Error ? createMut.error.message : "Error al crear solicitud"}
                  </p>
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {/* AI Date Suggestions */}
        <DateSuggestions
          onSelectDates={(start, end) => {
            setShowForm(true);
          }}
        />

        {/* Requests table */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Mis Solicitudes</h2>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {[
                { value: "", label: "Todas" },
                { value: "PENDING", label: "Pendientes" },
                { value: "APPROVED", label: "Aprobadas" },
                { value: "REJECTED", label: "Rechazadas" },
                { value: "CANCELLED", label: "Canceladas" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    statusFilter === opt.value
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <RequestsTable
            data={requestsQ.data ?? []}
            isLoading={requestsQ.isLoading}
            showActions
            onEdit={(req: VacationRequest) => setEditTarget(req)}
            onCancel={(req: VacationRequest) => setCancelTarget(req)}
            onView={(req: VacationRequest) => setViewTarget(req)}
            onExportICS={(req: VacationRequest) => {
              api.calendarExport.exportICS(req.id).then(() => {
                toast("success", "Archivo .ics descargado — ábrelo para agregar a tu calendario");
              }).catch((e: Error) => {
                toast("error", e.message || "Error al exportar calendario");
              });
            }}
            emptyMessage="No tienes solicitudes de vacaciones."
          />
        </div>

        {/* Calendar */}
        <VacationCalendar title="Calendario de Vacaciones" />

        {/* Detail modal */}
        <RequestDetailModal
          open={!!viewTarget}
          onClose={() => setViewTarget(null)}
          request={viewTarget}
          onToast={toast}
        />

        {/* Edit modal */}
        <EditRequestModal
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          request={editTarget}
          onConfirm={async (id, payload) => {
            await editMut.mutateAsync({ requestId: id, payload });
          }}
          loading={editMut.isPending}
        />

        {/* Cancel dialog */}
        <CancelDialog
          open={!!cancelTarget}
          onClose={() => setCancelTarget(null)}
          request={cancelTarget}
          onConfirm={async (id) => {
            await cancelMut.mutateAsync(id);
          }}
          loading={cancelMut.isPending}
        />
      </div>
    </RoleGuard>
  );
}
