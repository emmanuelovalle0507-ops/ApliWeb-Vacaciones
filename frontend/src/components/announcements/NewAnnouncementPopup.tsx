"use client";

import React, { useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Megaphone,
  UserPlus,
  AlertTriangle,
  PartyPopper,
  Clock,
  Globe,
  Paperclip,
  CheckCircle,
} from "lucide-react";
import api from "@/api/client";
import { useAuth } from "@/providers/AuthProvider";
import type { Announcement, AnnouncementType } from "@/types";

function getAuthFileUrl(url: string): string {
  if (!url) return "";
  const token = typeof window !== "undefined" ? localStorage.getItem("vc_token") : null;
  return token ? `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}` : url;
}

const REACTION_EMOJIS = ["👍", "❤️", "🎉", "😂"];

const TYPE_STYLE: Record<
  AnnouncementType,
  { icon: React.ReactNode; label: string; color: string; bg: string; ring: string }
> = {
  NEW_EMPLOYEE: {
    icon: <UserPlus size={22} />,
    label: "Nuevo integrante",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    ring: "ring-emerald-200",
  },
  URGENT: {
    icon: <AlertTriangle size={22} />,
    label: "Urgente",
    color: "text-red-600",
    bg: "bg-red-50",
    ring: "ring-red-300",
  },
  CELEBRATION: {
    icon: <PartyPopper size={22} />,
    label: "Celebración",
    color: "text-amber-600",
    bg: "bg-amber-50",
    ring: "ring-amber-200",
  },
  GENERAL: {
    icon: <Megaphone size={22} />,
    label: "General",
    color: "text-blue-600",
    bg: "bg-blue-50",
    ring: "ring-blue-200",
  },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days}d`;
  return new Date(dateStr).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

const CONFETTI_TYPES: AnnouncementType[] = ["CELEBRATION", "NEW_EMPLOYEE"];

function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#f59e0b", "#ef4444", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#f97316", "#06b6d4"];
    const particles: { x: number; y: number; w: number; h: number; color: string; vx: number; vy: number; rot: number; vr: number; opacity: number }[] = [];

    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height * -1,
        w: Math.random() * 8 + 4,
        h: Math.random() * 4 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.2,
        opacity: 1,
      });
    }

    let frame = 0;
    const maxFrames = 180;

    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame++;

      const fadeStart = maxFrames * 0.6;
      for (const p of particles) {
        p.x += p.vx;
        p.vy += 0.05;
        p.y += p.vy;
        p.rot += p.vr;
        if (frame > fadeStart) p.opacity = Math.max(0, 1 - (frame - fadeStart) / (maxFrames - fadeStart));

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (frame < maxFrames) {
        animRef.current = requestAnimationFrame(animate);
      }
    }

    animRef.current = requestAnimationFrame(animate);

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[61] pointer-events-none"
      aria-hidden="true"
    />
  );
}

export default function NewAnnouncementPopup() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["announcements", user?.id, "", false],
    queryFn: () => api.announcements.listMine(undefined, undefined, false),
    enabled: !!user,
    refetchInterval: 30000,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["announcements"] });
    qc.invalidateQueries({ queryKey: ["announcements.pinned"] });
    qc.invalidateQueries({ queryKey: ["announcements.unreadCount"] });
    qc.invalidateQueries({ queryKey: ["announcements.history"] });
    qc.invalidateQueries({ queryKey: ["announcements.history.search"] });
  };

  const markReadMut = useMutation({
    mutationFn: (id: string) => api.announcements.markRead(id),
    onSuccess: invalidateAll,
  });

  const reactionMut = useMutation({
    mutationFn: ({ id, emoji }: { id: string; emoji: string }) => api.announcements.toggleReaction(id, emoji),
    onSuccess: invalidateAll,
  });

  const acknowledgeMut = useMutation({
    mutationFn: (id: string) => api.announcements.acknowledge(id),
    onSuccess: invalidateAll,
  });

  const handleEnterado = (announcement: Announcement) => {
    if (announcement.requiresAcknowledgment && !announcement.isAcknowledged) {
      markReadMut.mutate(announcement.id, {
        onSuccess: () => acknowledgeMut.mutate(announcement.id),
      });
    } else {
      markReadMut.mutate(announcement.id);
    }
  };

  const unreadAnn = useMemo(() => {
    const items = data?.items ?? [];
    return items.filter((a: Announcement) => !a.isRead);
  }, [data]);

  // Show only the most recent unread
  const ann = unreadAnn.length > 0 ? unreadAnn[0] : null;

  if (!ann) return null;

  const cfg = TYPE_STYLE[ann.type] || TYPE_STYLE.GENERAL;
  const showConfetti = CONFETTI_TYPES.includes(ann.type);
  const isUrgent = ann.type === "URGENT";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
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
          @keyframes urgent-badge-pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
          .urgent-modal { animation: urgent-pulse-ring 2s ease-in-out infinite; }
          .urgent-icon { animation: urgent-shake 3s ease-in-out infinite; }
          .urgent-glow { animation: urgent-glow 2s ease-in-out infinite; }
          .urgent-stripe {
            background-image: repeating-linear-gradient(
              -45deg, transparent, transparent 8px, rgba(239,68,68,0.08) 8px, rgba(239,68,68,0.08) 16px
            );
            animation: urgent-stripe 1.5s linear infinite;
          }
          .urgent-badge { animation: urgent-badge-pulse 2s ease-in-out infinite; }
        `}</style>
      )}

      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Urgent red glow behind modal */}
      {isUrgent && (
        <div className="urgent-glow fixed inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at center, rgba(239,68,68,0.15) 0%, transparent 70%)" }} />
      )}

      {/* Confetti for celebration/new employee */}
      {showConfetti && <ConfettiCanvas />}

      {/* Modal */}
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 ring-2 ${cfg.ring} animate-in fade-in zoom-in-95 duration-200 ${isUrgent ? "urgent-modal" : ""}`}>
        {/* Urgent top stripe bar */}
        {isUrgent && (
          <div className="urgent-stripe h-1.5 bg-gradient-to-r from-red-500 via-rose-500 to-red-500 rounded-t-2xl" />
        )}

        {/* Type banner */}
        <div className={`flex items-center gap-3 px-6 pt-6 pb-3`}>
          <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${cfg.bg} ${cfg.color} ${isUrgent ? "urgent-icon" : ""}`}>
            {cfg.icon}
          </div>
          <div>
            <span className={`text-xs font-bold uppercase tracking-wider ${cfg.color}`}>
              {cfg.label}
            </span>
            <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
              {ann.isBroadcast ? (
                <span className="flex items-center gap-0.5"><Globe size={11} /> Toda la empresa</span>
              ) : ann.teamNames.length > 0 ? (
                <span>{ann.teamNames.join(", ")}</span>
              ) : null}
              <span className="flex items-center gap-0.5"><Clock size={11} /> {timeAgo(ann.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Image */}
        {ann.imageUrl && (
          <div className="px-6 pb-2">
            <img
              src={getAuthFileUrl(ann.imageUrl)}
              alt={ann.title || "Anuncio"}
              className="w-full max-h-72 object-contain rounded-xl border border-gray-100"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        )}

        {/* Content */}
        <div className="px-6 pb-4">
          {ann.title && <h3 className="text-lg font-bold text-gray-900 mt-1">{ann.title}</h3>}
          {ann.body && (
            <p className="text-sm text-gray-600 mt-2 whitespace-pre-line leading-relaxed max-h-60 overflow-y-auto">
              {ann.body}
            </p>
          )}

          {/* Attachment */}
          {ann.attachmentUrl && (
            <a
              href={ann.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-xs text-seekop-600 hover:text-seekop-700 bg-seekop-50 px-2.5 py-1.5 rounded-lg"
            >
              <Paperclip size={12} />
              {ann.attachmentName || "Ver adjunto"}
            </a>
          )}

          {/* Reactions */}
          <div className="flex items-center gap-1.5 mt-4 flex-wrap">
            {REACTION_EMOJIS.map((emoji) => {
              const r = ann.reactions?.find((rx) => rx.emoji === emoji);
              const myReacted = ann.myReactions?.includes(emoji);
              return (
                <button
                  key={emoji}
                  onClick={() => reactionMut.mutate({ id: ann.id, emoji })}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm border transition-colors ${
                    myReacted
                      ? "bg-seekop-50 border-seekop-300 text-seekop-700 shadow-sm"
                      : "bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-100"
                  }`}
                  title={r?.userNames?.join(", ") || ""}
                >
                  <span>{emoji}</span>
                  {r && r.count > 0 && <span className="font-medium text-xs">{r.count}</span>}
                </button>
              );
            })}
          </div>

          {/* Author */}
          {ann.authorName && (
            <p className="text-xs text-gray-400 mt-3">
              Publicado por <span className="font-medium text-gray-500">{ann.authorName}</span>
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={() => handleEnterado(ann)}
            disabled={markReadMut.isPending || acknowledgeMut.isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-seekop-600 hover:bg-seekop-700 rounded-xl transition-colors disabled:opacity-50"
          >
            <CheckCircle size={16} />
            {(markReadMut.isPending || acknowledgeMut.isPending) ? "Marcando..." : "Enterado"}
          </button>
          {unreadAnn.length > 1 && (
            <p className="text-center text-xs text-gray-400 mt-2">
              +{unreadAnn.length - 1} anuncio{unreadAnn.length - 1 > 1 ? "s" : ""} más sin leer
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
