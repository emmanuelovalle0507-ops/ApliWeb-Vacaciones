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
import VacationCalendar from "@/components/calendar/VacationCalendar";
import { useToast } from "@/components/ui/Toast";

export default function EmployeeDashboardPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const year = new Date().getFullYear();

  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<VacationRequest | null>(null);

  const balanceQ = useQuery({
    queryKey: ["balance", user?.id, year],
    queryFn: () => api.balance.getMyBalance(user!.id, year),
    enabled: !!user,
  });

  const requestsQ = useQuery({
    queryKey: ["myRequests", user?.id],
    queryFn: async () => {
      const res = await api.requests.listMine(user!.id);
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
          <Button onClick={() => setShowForm(!showForm)}>
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

        {/* Requests table */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Mis Solicitudes</h2>
          <RequestsTable
            data={requestsQ.data ?? []}
            isLoading={requestsQ.isLoading}
            showActions
            onCancel={(req: VacationRequest) => setCancelTarget(req)}
            emptyMessage="No tienes solicitudes de vacaciones."
          />
        </div>

        {/* Calendar */}
        <VacationCalendar title="Calendario de Vacaciones" />

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
