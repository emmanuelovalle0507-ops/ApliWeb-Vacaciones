"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { X, Eye, EyeOff, BarChart3, CheckCircle, Clock } from "lucide-react";
import api from "@/api/client";

interface Props {
  announcementId: string | null;
  onClose: () => void;
}

export default function AnnouncementStatsModal({ announcementId, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["announcementStats", announcementId],
    queryFn: () => api.announcements.getStats(announcementId!),
    enabled: !!announcementId,
  });

  if (!announcementId || !mounted) return null;

  const readPercent = stats ? Math.round((stats.readCount / Math.max(1, stats.totalTargetUsers)) * 100) : 0;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <BarChart3 size={20} />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Estadísticas de lectura</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {isLoading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-seekop-500 border-t-transparent rounded-full" />
            </div>
          )}

          {stats && (
            <>
              {/* Progress */}
              <div className="text-center">
                <div className="relative inline-flex items-center justify-center w-24 h-24">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="16" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="16" fill="none"
                      stroke="#10b981" strokeWidth="3"
                      strokeDasharray={`${readPercent} 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute text-xl font-bold text-gray-900">{readPercent}%</span>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  {stats.readCount} de {stats.totalTargetUsers} personas
                </p>
              </div>

              {/* Read list */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Eye size={14} className="text-emerald-500" />
                  <h3 className="text-sm font-semibold text-gray-700">
                    Visto por ({stats.readUsers.length})
                  </h3>
                </div>
                {stats.readUsers.length === 0 ? (
                  <p className="text-xs text-gray-400 pl-6">Nadie ha visto este anuncio</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {stats.readUsers.map((u) => (
                      <div key={u.userId} className="flex items-center justify-between px-3 py-1.5 bg-emerald-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <CheckCircle size={13} className="text-emerald-500" />
                          <span className="text-sm text-gray-700">{u.fullName}</span>
                        </div>
                        {u.readAt && (
                          <span className="text-[10px] text-gray-400">
                            {new Date(u.readAt).toLocaleDateString("es-MX", {
                              day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Unread list */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <EyeOff size={14} className="text-gray-400" />
                  <h3 className="text-sm font-semibold text-gray-700">
                    Sin ver ({stats.unreadUsers.length})
                  </h3>
                </div>
                {stats.unreadUsers.length === 0 ? (
                  <p className="text-xs text-gray-400 pl-6">Todos han visto el anuncio</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {stats.unreadUsers.map((u) => (
                      <div key={u.userId} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg">
                        <Clock size={13} className="text-gray-400" />
                        <span className="text-sm text-gray-500">{u.fullName}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-5 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
