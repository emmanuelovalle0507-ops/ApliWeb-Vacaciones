"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCheck,
  X,
  FileText,
  CheckCircle2,
  XCircle,
  Ban,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import api from "@/api/client";
import type { NotificationEvent, NotificationType } from "@/types";

const TYPE_CONFIG: Record<NotificationType, { icon: React.ElementType; color: string; bg: string }> = {
  REQUEST_CREATED: { icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
  REQUEST_APPROVED: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
  REQUEST_REJECTED: { icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
  REQUEST_CANCELLED: { icon: Ban, color: "text-gray-500", bg: "bg-gray-50" },
  POLICY_UPDATED: { icon: ShieldCheck, color: "text-indigo-600", bg: "bg-indigo-50" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `hace ${days}d`;
  return new Date(dateStr).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

function NotificationItem({
  notif,
  onMarkRead,
}: {
  notif: NotificationEvent;
  onMarkRead: (id: string) => void;
}) {
  const cfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.REQUEST_CREATED;
  const Icon = cfg.icon;

  return (
    <button
      onClick={() => !notif.isRead && onMarkRead(notif.id)}
      className={`w-full text-left flex gap-3 px-4 py-3 transition-colors hover:bg-gray-50 ${
        notif.isRead ? "opacity-60" : ""
      }`}
    >
      <div className={`shrink-0 mt-0.5 p-2 rounded-full ${cfg.bg}`}>
        <Icon size={16} className={cfg.color} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-snug ${notif.isRead ? "text-gray-600" : "text-gray-900 font-medium"}`}>
          {notif.title}
        </p>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.body}</p>
        <p className="text-[11px] text-gray-400 mt-1">{timeAgo(notif.createdAt)}</p>
      </div>
      {!notif.isRead && <span className="shrink-0 mt-2 w-2 h-2 rounded-full bg-blue-500" />}
    </button>
  );
}

export default function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Poll unread count every 30s
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => api.notifications.getUnreadCount(),
    refetchInterval: 30_000,
  });

  // Fetch full list only when panel is open
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", "list"],
    queryFn: async () => {
      const res = await api.notifications.listMine("");
      return res.items;
    },
    enabled: open,
    refetchInterval: open ? 15_000 : false,
  });

  const markReadMut = useMutation({
    mutationFn: (id: string) => api.notifications.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllMut = useMutation({
    mutationFn: () => api.notifications.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleMarkRead = useCallback(
    (id: string) => markReadMut.mutate(id),
    [markReadMut]
  );

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        aria-label="Notificaciones"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 mt-2 w-96 max-h-[480px] bg-white border border-gray-200 rounded-xl shadow-xl z-50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Notificaciones</h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllMut.mutate()}
                  disabled={markAllMut.isPending}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
                >
                  <CheckCheck size={14} />
                  Marcar todo leído
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="text-gray-400 animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Bell size={32} className="mb-2 opacity-40" />
                <p className="text-sm">No tienes notificaciones</p>
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationItem key={n.id} notif={n} onMarkRead={handleMarkRead} />
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-2 text-center">
              <span className="text-xs text-gray-400">
                {unreadCount > 0 ? `${unreadCount} sin leer` : "Todo leído"}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
