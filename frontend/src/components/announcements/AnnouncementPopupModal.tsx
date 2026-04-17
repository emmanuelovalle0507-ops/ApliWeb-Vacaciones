"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X,
  Megaphone,
  UserPlus,
  AlertTriangle,
  PartyPopper,
  CheckCircle,
  Eye,
  Clock,
  Globe,
  Paperclip,
  ChevronRight,
} from "lucide-react";
import api from "@/api/client";
import { useAuth } from "@/providers/AuthProvider";
import type { Announcement, AnnouncementType, ReactionSummary } from "@/types";

const TYPE_CONFIG: Record<
  AnnouncementType,
  {
    icon: React.ReactNode;
    label: string;
    color: string;
    bg: string;
    border: string;
    gradient: string;
  }
> = {
  NEW_EMPLOYEE: {
    icon: <UserPlus size={22} />,
    label: "Nuevo integrante",
    color: "text-emerald-600",
    bg: "bg-emerald-100",
    border: "border-emerald-300",
    gradient: "from-emerald-500 to-teal-500",
  },
  URGENT: {
    icon: <AlertTriangle size={22} />,
    label: "Urgente",
    color: "text-red-600",
    bg: "bg-red-100",
    border: "border-red-300",
    gradient: "from-red-500 to-rose-500",
  },
  CELEBRATION: {
    icon: <PartyPopper size={22} />,
    label: "Celebración",
    color: "text-amber-600",
    bg: "bg-amber-100",
    border: "border-amber-300",
    gradient: "from-amber-500 to-orange-500",
  },
  GENERAL: {
    icon: <Megaphone size={22} />,
    label: "General",
    color: "text-blue-600",
    bg: "bg-blue-100",
    border: "border-blue-300",
    gradient: "from-blue-500 to-indigo-500",
  },
};

const REACTION_EMOJIS = ["👍", "❤️", "🎉", "😂"];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days}d`;
  return new Date(dateStr).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
  });
}

function getStorageKey(userId: string) {
  return `announcement_last_seen_${userId}`;
}

export default function AnnouncementPopupModal() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [queue, setQueue] = useState<Announcement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  const userId = user?.id ?? "";

  const since = typeof window !== "undefined" && userId
    ? localStorage.getItem(getStorageKey(userId)) || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: newAnnouncements } = useQuery({
    queryKey: ["announcements.newSince", userId, since],
    queryFn: () => api.announcements.listNewSince(since),
    enabled: !!userId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (newAnnouncements && newAnnouncements.length > 0 && queue.length === 0) {
      setQueue(newAnnouncements);
      setCurrentIndex(0);
      setVisible(true);
      setAnimating(true);
    }
  }, [newAnnouncements, queue.length]);

  const current = queue[currentIndex] ?? null;
  const cfg = current ? (TYPE_CONFIG[current.type] || TYPE_CONFIG.GENERAL) : TYPE_CONFIG.GENERAL;

  const invalidateAll = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["announcements"] });
    qc.invalidateQueries({ queryKey: ["announcements.pinned"] });
    qc.invalidateQueries({ queryKey: ["announcements.unreadCount"] });
    qc.invalidateQueries({ queryKey: ["announcements.newSince"] });
  }, [qc]);

  const markReadMut = useMutation({
    mutationFn: (id: string) => api.announcements.markRead(id),
    onSuccess: () => invalidateAll(),
  });

  const reactionMut = useMutation({
    mutationFn: ({ id, emoji }: { id: string; emoji: string }) =>
      api.announcements.toggleReaction(id, emoji),
    onSuccess: () => {
      invalidateAll();
      // Refresh current announcement reactions optimistically
      qc.invalidateQueries({ queryKey: ["announcements.newSince"] });
    },
  });

  const acknowledgeMut = useMutation({
    mutationFn: (id: string) => api.announcements.acknowledge(id),
    onSuccess: () => invalidateAll(),
  });

  const goNext = useCallback(() => {
    if (current) {
      if (current.requiresAcknowledgment && !current.isAcknowledged) {
        markReadMut.mutate(current.id, {
          onSuccess: () => acknowledgeMut.mutate(current.id),
        });
      } else {
        markReadMut.mutate(current.id);
      }
    }
    if (currentIndex < queue.length - 1) {
      setAnimating(false);
      setTimeout(() => {
        setCurrentIndex((i) => i + 1);
        setAnimating(true);
      }, 200);
    } else {
      // All done
      setAnimating(false);
      setTimeout(() => {
        setVisible(false);
        setQueue([]);
        setCurrentIndex(0);
        if (userId) {
          localStorage.setItem(getStorageKey(userId), new Date().toISOString());
        }
      }, 200);
    }
  }, [current, currentIndex, queue.length, markReadMut, acknowledgeMut, userId]);

  const handleAcknowledge = useCallback(() => {
    if (current) {
      acknowledgeMut.mutate(current.id);
      // Update local state
      setQueue((prev) =>
        prev.map((a) =>
          a.id === current.id ? { ...a, isAcknowledged: true } : a
        )
      );
    }
  }, [current, acknowledgeMut]);

  const handleReaction = useCallback(
    (emoji: string) => {
      if (!current) return;
      reactionMut.mutate({ id: current.id, emoji });
      // Optimistic update
      setQueue((prev) =>
        prev.map((a) => {
          if (a.id !== current.id) return a;
          const myReactions = a.myReactions.includes(emoji)
            ? a.myReactions.filter((e) => e !== emoji)
            : [...a.myReactions, emoji];
          const reactions = a.reactions.map((r: ReactionSummary) => {
            if (r.emoji !== emoji) return r;
            const added = !a.myReactions.includes(emoji);
            return {
              ...r,
              count: added ? r.count + 1 : Math.max(0, r.count - 1),
            };
          });
          // If emoji doesn't exist yet, add it
          if (!reactions.find((r: ReactionSummary) => r.emoji === emoji)) {
            reactions.push({ emoji, count: 1, userNames: [user?.fullName ?? ""] });
          }
          return { ...a, myReactions, reactions };
        })
      );
    },
    [current, reactionMut, user?.fullName]
  );

  if (!visible || !current) return null;

  const remaining = queue.length - currentIndex;
  const isUrgent = current.type === "URGENT";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Urgent keyframe animations */}
      {isUrgent && (
        <style>{`
          @keyframes urgent-pulse-ring {
            0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5), 0 0 20px rgba(239,68,68,0.15); }
            50% { box-shadow: 0 0 0 6px rgba(239,68,68,0), 0 0 30px rgba(239,68,68,0.25); }
          }
          @keyframes urgent-shake {
            0%, 100% { transform: rotate(0deg); }
            10% { transform: rotate(-12deg); }
            20% { transform: rotate(12deg); }
            30% { transform: rotate(-8deg); }
            40% { transform: rotate(8deg); }
            50% { transform: rotate(0deg); }
          }
          @keyframes urgent-glow {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 0.7; }
          }
          @keyframes urgent-stripe {
            0% { background-position: 0 0; }
            100% { background-position: 40px 0; }
          }
          .urgent-modal-popup { animation: urgent-pulse-ring 2s ease-in-out infinite; }
          .urgent-icon-popup { animation: urgent-shake 3s ease-in-out infinite; }
          .urgent-glow-popup { animation: urgent-glow 2s ease-in-out infinite; }
          .urgent-stripe-popup {
            background-image: repeating-linear-gradient(
              -45deg, transparent, transparent 8px, rgba(239,68,68,0.08) 8px, rgba(239,68,68,0.08) 16px
            );
            animation: urgent-stripe 1.5s linear infinite;
          }
        `}</style>
      )}

      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        style={{ opacity: animating ? 1 : 0 }}
      />

      {/* Urgent red glow behind modal */}
      {isUrgent && animating && (
        <div className="urgent-glow-popup fixed inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at center, rgba(239,68,68,0.18) 0%, transparent 70%)" }} />
      )}

      {/* Modal */}
      <div
        className={`relative w-full max-w-lg transform transition-all duration-300 ${
          animating
            ? "scale-100 opacity-100 translate-y-0"
            : "scale-95 opacity-0 translate-y-4"
        }`}
      >
        <div className={`bg-white rounded-2xl shadow-2xl overflow-hidden ${isUrgent ? "urgent-modal-popup ring-2 ring-red-300" : "ring-1 ring-black/5"}`}>
          {/* Colored header strip */}
          <div className={`h-1.5 bg-gradient-to-r ${cfg.gradient} ${isUrgent ? "urgent-stripe-popup" : ""}`} />

          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-5 pb-3">
            <div className="flex items-center gap-3">
              <div
                className={`flex items-center justify-center w-11 h-11 rounded-xl ${cfg.bg} ${cfg.color} ${isUrgent ? "urgent-icon-popup" : ""}`}
              >
                {cfg.icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}
                  >
                    {cfg.label}
                  </span>
                  {current.isBroadcast && (
                    <span className="text-xs text-gray-400 flex items-center gap-0.5">
                      <Globe size={11} /> Toda la empresa
                    </span>
                  )}
                  {!current.isBroadcast && current.teamNames.length > 0 && (
                    <span className="text-xs text-gray-400">
                      {current.teamNames.join(", ")}
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-gray-900 mt-0.5 leading-tight">
                  {current.title}
                </h2>
              </div>
            </div>
            <button
              onClick={goNext}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
              title="Cerrar"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 pb-4">
            <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed max-h-[40vh] sm:max-h-48 overflow-y-auto">
              {current.body}
            </p>

            {/* Attachment */}
            {current.attachmentUrl && (
              <a
                href={current.attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-xs text-seekop-600 hover:text-seekop-700 bg-seekop-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Paperclip size={13} />
                {current.attachmentName || "Ver adjunto"}
              </a>
            )}

            {/* Meta */}
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {timeAgo(current.createdAt)}
              </span>
              {current.authorName && <span>por {current.authorName}</span>}
              <span className="flex items-center gap-1">
                <Eye size={12} />
                {current.readCount} {current.readCount === 1 ? "visto" : "vistos"}
              </span>
            </div>
          </div>

          {/* Reactions bar */}
          <div className="px-6 pb-4">
            <div className="flex items-center gap-2 flex-wrap">
              {REACTION_EMOJIS.map((emoji) => {
                const r = current.reactions?.find(
                  (rx: ReactionSummary) => rx.emoji === emoji
                );
                const myReacted = current.myReactions?.includes(emoji);
                return (
                  <button
                    key={emoji}
                    onClick={() => handleReaction(emoji)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border-2 transition-all duration-200 ${
                      myReacted
                        ? "bg-seekop-50 border-seekop-300 text-seekop-700 shadow-sm scale-105"
                        : "bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                    title={r?.userNames?.join(", ") || ""}
                  >
                    <span className="text-base">{emoji}</span>
                    {r && r.count > 0 && (
                      <span className="font-semibold text-xs">{r.count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className={`flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/60`}>
            <div className="flex items-center gap-2">
              {remaining > 1 && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <span className="inline-flex items-center justify-center w-5 h-5 bg-seekop-100 text-seekop-700 rounded-full text-[10px] font-bold">
                    {remaining}
                  </span>
                  anuncios pendientes
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Acknowledge button */}
              {current.requiresAcknowledgment && !current.isAcknowledged && (
                <button
                  onClick={handleAcknowledge}
                  disabled={acknowledgeMut.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  <CheckCircle size={15} />
                  Enterado
                </button>
              )}
              {current.requiresAcknowledgment && current.isAcknowledged && (
                <span className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-green-700 bg-green-100 rounded-xl">
                  <CheckCircle size={15} />
                  Confirmado
                </span>
              )}
              {/* Next / Close button */}
              <button
                onClick={goNext}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-seekop-600 hover:bg-seekop-700 rounded-xl shadow-sm transition-all"
              >
                {remaining > 1 ? (
                  <>
                    Siguiente
                    <ChevronRight size={15} />
                  </>
                ) : (
                  "Cerrar"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
