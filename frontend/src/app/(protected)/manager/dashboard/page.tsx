"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Users, CheckCircle, Shield, MessageSquare } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import api from "@/api/client";
import type { VacationRequest } from "@/types";
import RoleGuard from "@/components/layout/RoleGuard";
import Card, { CardBody } from "@/components/ui/Card";
import Tabs from "@/components/ui/Tabs";
import RequestsTable from "@/components/vacations/RequestsTable";
import ApprovalModal from "@/components/vacations/ApprovalModal";
import TeamPolicyForm from "@/components/vacations/TeamPolicyForm";
import TeamPolicyAgentPanel from "@/components/ai/TeamPolicyAgentPanel";
import AIChatPanel from "@/components/ai/AIChatPanel";
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
    queryFn: () => api.approvals.listPending(user!.id),
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

  const teamCount = teamMembersQ.data?.length ?? 0;

  const tabs = [
    {
      id: "requests",
      label: "Solicitudes Pendientes",
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardBody className="flex items-start gap-4">
              <div className="p-2.5 rounded-lg text-amber-600 bg-amber-50">
                <ClipboardList size={22} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pendientes</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{pendingQ.data?.length ?? 0}</p>
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
        </div>

        {/* Tabs: Solicitudes | Políticas | IA */}
        <Tabs tabs={tabs} defaultTab="requests" />
      </div>
    </RoleGuard>
  );
}
