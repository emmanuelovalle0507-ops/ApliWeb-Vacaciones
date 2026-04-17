"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, CheckCircle, XCircle, Clock, Megaphone } from "lucide-react";
import api from "@/api/client";
import { useToast } from "@/components/ui/Toast";
import type { Announcement } from "@/types";

export default function PendingApprovalPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["announcements.pendingApproval"],
    queryFn: () => api.announcements.listPendingApproval(),
    refetchInterval: 30000,
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => api.announcements.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements.pendingApproval"] });
      qc.invalidateQueries({ queryKey: ["announcements"] });
      toast("success", "Anuncio aprobado y publicado");
    },
    onError: (err) => toast("error", err instanceof Error ? err.message : "Error"),
  });

  const rejectMut = useMutation({
    mutationFn: (id: string) => api.announcements.reject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements.pendingApproval"] });
      toast("success", "Anuncio rechazado");
    },
    onError: (err) => toast("error", err instanceof Error ? err.message : "Error"),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <div className="animate-spin h-5 w-5 border-2 border-seekop-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <ShieldCheck size={32} className="mx-auto mb-2 opacity-40" />
        <p className="text-sm">No hay anuncios pendientes de aprobación</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck size={18} className="text-amber-500" />
        <h4 className="text-sm font-semibold text-gray-900">
          Pendientes de aprobación ({items.length})
        </h4>
      </div>
      {items.map((ann: Announcement) => (
        <div
          key={ann.id}
          className="border border-amber-200 bg-amber-50/50 rounded-xl p-4"
        >
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 text-amber-600 shrink-0">
              <Megaphone size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                  {ann.type}
                </span>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock size={11} />
                  por {ann.authorName}
                </span>
              </div>
              <h4 className="text-sm font-semibold text-gray-900 mt-1">{ann.title}</h4>
              <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{ann.body}</p>
              {ann.teamNames.length > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  Equipos: {ann.teamNames.join(", ")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => approveMut.mutate(ann.id)}
                disabled={approveMut.isPending}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <CheckCircle size={13} />
                Aprobar
              </button>
              <button
                onClick={() => {
                  if (confirm("¿Rechazar este anuncio?")) rejectMut.mutate(ann.id);
                }}
                disabled={rejectMut.isPending}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50"
              >
                <XCircle size={13} />
                Rechazar
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
