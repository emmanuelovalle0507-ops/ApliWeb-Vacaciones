"use client";

import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusCircle, Lightbulb, X, FileText, Sun, Moon, Sunrise } from "lucide-react";
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
import PinnedAnnouncements from "@/components/announcements/PinnedAnnouncements";
import AnnouncementFeed from "@/components/announcements/AnnouncementFeed";
import NewAnnouncementPopup from "@/components/announcements/NewAnnouncementPopup";
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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [prefillDates, setPrefillDates] = useState<{ start: string; end: string } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return { text: "Buenos días", icon: <Sunrise size={20} className="text-amber-400" /> };
    if (h < 19) return { text: "Buenas tardes", icon: <Sun size={20} className="text-amber-500" /> };
    return { text: "Buenas noches", icon: <Moon size={20} className="text-indigo-400" /> };
  }, []);

  const todayStr = useMemo(() => {
    return new Date().toLocaleDateString("es-MX", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  }, []);

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
        <PinnedAnnouncements />
        <NewAnnouncementPopup />

        {/* ── Header ── */}
        <div className="animate-card-enter stagger-1">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {greeting.icon}
                <span className="text-sm font-medium text-slate-500">{greeting.text}</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {user?.fullName?.split(" ")[0] ?? "Dashboard"}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5 capitalize">{todayStr}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="secondary"
                onClick={() => setShowSuggestions(true)}
                className="gap-2 shadow-sm text-xs sm:text-sm"
              >
                <Lightbulb size={16} />
                <span className="hidden sm:inline">Buscar fechas óptimas</span>
                <span className="sm:hidden">Fechas IA</span>
              </Button>
              <Button
                onClick={() => {
                  setShowForm((v) => {
                    if (v) setPrefillDates(null);
                    return !v;
                  });
                }}
                className="shadow-sm text-xs sm:text-sm"
              >
                <PlusCircle size={16} className="mr-1.5 sm:mr-2" />
                {showForm ? "Cerrar" : "Nueva Solicitud"}
              </Button>
            </div>
          </div>
        </div>

        {/* ── Balance ── */}
        <div className="animate-card-enter stagger-2">
          <BalanceCard balance={balanceQ.data ?? null} isLoading={balanceQ.isLoading} />
        </div>

        {/* ── Nueva solicitud form ── */}
        {showForm && (
          <Card className="animate-card-enter border-l-4 border-l-seekop-accent">
            <CardBody>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-1 h-5 rounded-full bg-seekop-accent" />
                <h2 className="text-base font-bold text-slate-800">Nueva Solicitud de Vacaciones</h2>
              </div>
              <RequestForm
                availableDays={balanceQ.data?.availableDays ?? 0}
                onSubmit={async (data) => { await createMut.mutateAsync(data); setPrefillDates(null); }}
                onCancel={() => { setShowForm(false); setPrefillDates(null); }}
                initialStartDate={prefillDates?.start}
                initialEndDate={prefillDates?.end}
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

        {/* ── Anuncios del equipo ── */}
        <div className="animate-card-enter stagger-3">
          <AnnouncementFeed />
        </div>

        {/* ── Mis Solicitudes ── */}
        <div className="animate-card-enter stagger-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-seekop-50 border border-seekop-100 flex items-center justify-center">
                <FileText size={17} className="text-seekop-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800 leading-tight">Mis Solicitudes</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {(requestsQ.data ?? []).length} solicitud{(requestsQ.data ?? []).length !== 1 ? "es" : ""} registrada{(requestsQ.data ?? []).length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {/* Status filter tabs */}
            <div className="flex gap-1 bg-slate-100/80 rounded-xl p-1 border border-slate-200/50 overflow-x-auto">
              {[
                { value: "", label: "Todas", dot: "bg-slate-400" },
                { value: "PENDING", label: "Pendientes", dot: "bg-amber-400" },
                { value: "APPROVED", label: "Aprobadas", dot: "bg-emerald-500" },
                { value: "REJECTED", label: "Rechazadas", dot: "bg-red-400" },
                { value: "CANCELLED", label: "Canceladas", dot: "bg-slate-300" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 whitespace-nowrap ${
                    statusFilter === opt.value
                      ? "bg-white text-seekop-700 shadow-sm border border-seekop-200/60"
                      : "text-slate-500 hover:text-slate-700 border border-transparent"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${opt.dot}`} />
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

        {/* ── Calendario ── */}
        <div className="animate-card-enter stagger-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-xl bg-seekop-50 border border-seekop-100 flex items-center justify-center">
              <span className="text-seekop-600 text-base">📅</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-tight">Calendario del equipo</h2>
              <p className="text-xs text-slate-400 mt-0.5">Visualiza vacaciones y feriados</p>
            </div>
          </div>
          <VacationCalendar title="Calendario de Vacaciones" />
        </div>

        {/* ── AI Suggestions Modal ── */}
        {showSuggestions && mounted && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowSuggestions(false)} />
            <div className="relative w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl">
              <button
                onClick={() => setShowSuggestions(false)}
                className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-white/80 hover:bg-white text-gray-500 hover:text-gray-700 shadow-sm transition-colors"
              >
                <X size={16} />
              </button>
              <DateSuggestions
                onSelectDates={(start, end) => {
                  setPrefillDates({ start, end });
                  setShowSuggestions(false);
                  setShowForm(true);
                }}
              />
            </div>
          </div>,
          document.body
        )}

        {/* ── Modals ── */}
        <RequestDetailModal open={!!viewTarget} onClose={() => setViewTarget(null)} request={viewTarget} onToast={toast} />
        <EditRequestModal
          open={!!editTarget} onClose={() => setEditTarget(null)} request={editTarget}
          onConfirm={async (id, payload) => { await editMut.mutateAsync({ requestId: id, payload }); }}
          loading={editMut.isPending}
        />
        <CancelDialog
          open={!!cancelTarget} onClose={() => setCancelTarget(null)} request={cancelTarget}
          onConfirm={async (id) => { await cancelMut.mutateAsync(id); }}
          loading={cancelMut.isPending}
        />
      </div>
    </RoleGuard>
  );
}
