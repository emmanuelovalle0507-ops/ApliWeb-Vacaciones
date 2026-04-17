"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Megaphone,
  UserPlus,
  AlertTriangle,
  PartyPopper,
  Eye,
  Pin,
  Trash2,
  BarChart3,
  Clock,
  CheckCircle,
  Globe,
  X,
  Paperclip,
  Archive,
  ChevronLeft,
  ChevronRight,
  History,
  LayoutList,
  LayoutGrid,
  Timer,
} from "lucide-react";
import api from "@/api/client";
import { useAuth } from "@/providers/AuthProvider";
import type { Announcement, AnnouncementType } from "@/types";
import { useToast } from "@/components/ui/Toast";
import AnnouncementHistoryModal from "./AnnouncementHistoryModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import useAnnouncementWebSocket from "@/hooks/useAnnouncementWebSocket";

const SLIDE_DURATION = 8000;

function getAuthFileUrl(url: string): string {
  if (!url) return "";
  const token = typeof window !== "undefined" ? localStorage.getItem("vc_token") : null;
  return token ? `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}` : url;
}

function getExpiryWarning(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return null;
  if (diff <= 3600000) return `Expira en ${Math.ceil(diff / 60000)}min`;
  if (diff <= 86400000) return `Expira en ${Math.ceil(diff / 3600000)}h`;
  return null;
}

const TYPE_CONFIG: Record<
  AnnouncementType,
  { icon: React.ReactNode; label: string; color: string; border: string; bg: string }
> = {
  NEW_EMPLOYEE: {
    icon: <UserPlus size={16} />,
    label: "Nuevo integrante",
    color: "text-emerald-600",
    border: "border-emerald-200",
    bg: "bg-emerald-50",
  },
  URGENT: {
    icon: <AlertTriangle size={16} />,
    label: "Urgente",
    color: "text-red-600",
    border: "border-red-200",
    bg: "bg-red-50",
  },
  CELEBRATION: {
    icon: <PartyPopper size={16} />,
    label: "Celebración",
    color: "text-amber-600",
    border: "border-amber-200",
    bg: "bg-amber-50",
  },
  GENERAL: {
    icon: <Megaphone size={16} />,
    label: "General",
    color: "text-blue-600",
    border: "border-blue-200",
    bg: "bg-blue-50",
  },
};

const TYPE_FILTERS: { value: AnnouncementType | ""; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "URGENT", label: "Urgente" },
  { value: "GENERAL", label: "General" },
  { value: "CELEBRATION", label: "Celebración" },
  { value: "NEW_EMPLOYEE", label: "Nuevo integrante" },
];

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
  return new Date(dateStr).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

interface AnnouncementFeedProps {
  canCreate?: boolean;
  canPin?: boolean;
  canDelete?: boolean;
  canViewStats?: boolean;
  onCreateClick?: () => void;
  onStatsClick?: (id: string) => void;
}

export default function AnnouncementFeed({
  canCreate = false,
  canPin = false,
  canDelete = false,
  canViewStats = false,
  onCreateClick,
  onStatsClick,
}: AnnouncementFeedProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [slideIndex, setSlideIndex] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [typeFilter, setTypeFilter] = useState<AnnouncementType | "">("");
  const [viewMode, setViewMode] = useState<"carousel" | "list">("carousel");
  const [barWidth, setBarWidth] = useState(0);

  const isPausedRef = useRef(false);
  isPausedRef.current = isPaused;

  // WebSocket real — reemplaza el polling
  useAnnouncementWebSocket();

  const invalidateAll = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["announcements"] });
    qc.invalidateQueries({ queryKey: ["announcements.pinned"] });
    qc.invalidateQueries({ queryKey: ["announcements.unreadCount"] });
    qc.invalidateQueries({ queryKey: ["announcements.history"] });
    qc.invalidateQueries({ queryKey: ["announcements.history.search"] });
  }, [qc]);

  const { data, isLoading } = useQuery({
    queryKey: ["announcements", user?.id, "", false],
    queryFn: () => api.announcements.listMine(undefined, undefined, false),
    enabled: !!user,
  });

  const markReadMut = useMutation({ mutationFn: (id: string) => api.announcements.markRead(id), onSuccess: () => invalidateAll() });
  const pinMut = useMutation({ mutationFn: (id: string) => api.announcements.togglePin(id), onSuccess: () => { invalidateAll(); toast("success", "Pin actualizado"); }, onError: (err) => toast("error", err instanceof Error ? err.message : "Error") });
  const dismissMut = useMutation({ mutationFn: (id: string) => api.announcements.dismiss(id), onSuccess: () => { invalidateAll(); toast("success", "Anuncio oculto"); }, onError: (err) => toast("error", err instanceof Error ? err.message : "Error") });
  const deleteMut = useMutation({ mutationFn: (id: string) => api.announcements.delete(id), onSuccess: () => { invalidateAll(); toast("success", "Anuncio eliminado"); }, onError: (err) => toast("error", err instanceof Error ? err.message : "Error") });
  const reactionMut = useMutation({ mutationFn: ({ id, emoji }: { id: string; emoji: string }) => api.announcements.toggleReaction(id, emoji), onSuccess: () => invalidateAll() });
  const acknowledgeMut = useMutation({ mutationFn: (id: string) => api.announcements.acknowledge(id), onSuccess: () => { invalidateAll(); toast("success", "Enterado confirmado"); }, onError: (err) => toast("error", err instanceof Error ? err.message : "Error") });
  const archiveMut = useMutation({ mutationFn: (id: string) => api.announcements.archive(id), onSuccess: () => { invalidateAll(); toast("success", "Anuncio archivado"); }, onError: (err) => toast("error", err instanceof Error ? err.message : "Error") });

  const allItems: Announcement[] = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const filteredItems = typeFilter
    ? allItems.filter((i) => i.type === typeFilter)
    : allItems;
  const total = filteredItems.length;

  // Reset slideIndex when filter changes or total shrinks
  useEffect(() => {
    setSlideIndex(0);
  }, [typeFilter]);

  useEffect(() => {
    if (slideIndex >= total && total > 0) setSlideIndex(total - 1);
    if (total === 0) setSlideIndex(0);
  }, [total, slideIndex]);

  // Auto-advance carousel
  useEffect(() => {
    if (total <= 1 || isPaused || viewMode !== "carousel") return;
    const timer = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % total);
    }, SLIDE_DURATION);
    return () => clearInterval(timer);
  }, [total, isPaused, viewMode]);

  // Progress bar — pauses correctly on hover
  useEffect(() => {
    setBarWidth(0);
    if (total <= 1 || viewMode !== "carousel") return;

    let elapsed = 0;
    let lastTick = performance.now();

    const id = setInterval(() => {
      const now = performance.now();
      if (!isPausedRef.current) {
        elapsed += now - lastTick;
      }
      lastTick = now;
      setBarWidth(Math.min((elapsed / SLIDE_DURATION) * 100, 100));
    }, 50);

    return () => clearInterval(id);
  }, [slideIndex, total, viewMode]);

  const goPrev = useCallback(() => setSlideIndex((i) => (i - 1 + total) % total), [total]);
  const goNext = useCallback(() => setSlideIndex((i) => (i + 1) % total), [total]);

  const ann = total > 0 ? filteredItems[slideIndex] : null;
  const cfg = ann ? (TYPE_CONFIG[ann.type] || TYPE_CONFIG.GENERAL) : TYPE_CONFIG.GENERAL;

  function AnnouncementCard({ item, compact = false }: { item: Announcement; compact?: boolean }) {
    const c = TYPE_CONFIG[item.type] || TYPE_CONFIG.GENERAL;
    const expiryWarn = getExpiryWarning(item.expiresAt);

    return (
      <div className={`border rounded-2xl p-4 transition-all ${c.border} ${item.isRead ? "bg-white shadow-sm" : `${c.bg} shadow-md`}`}>
        {item.isPinned && (
          <div className="absolute -top-2 -right-2 bg-amber-400 text-white rounded-full p-1 shadow-sm z-10">
            <Pin size={12} />
          </div>
        )}

        <div className="flex items-start gap-3">
          <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${c.bg} ${c.color} shrink-0`}>
            {c.icon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.bg} ${c.color}`}>
                {c.label}
              </span>
              {item.isBroadcast && (
                <span className="text-xs text-gray-400 flex items-center gap-0.5">
                  <Globe size={11} /> Toda la empresa
                </span>
              )}
              {!item.isBroadcast && item.teamNames.length > 0 && (
                <span className="text-xs text-gray-400">{item.teamNames.join(", ")}</span>
              )}
              {!item.isRead && <span className="w-2 h-2 bg-blue-500 rounded-full" title="No leído" />}
              {item.requiresAcknowledgment && !item.isAcknowledged && (
                <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">Requiere confirmación</span>
              )}
              {expiryWarn && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                  <Timer size={10} /> {expiryWarn}
                </span>
              )}
            </div>

            {item.title && <h4 className="text-sm font-semibold text-gray-900 mt-1">{item.title}</h4>}
            {item.body && (
              <p className={`text-sm text-gray-600 mt-0.5 whitespace-pre-line break-words ${compact ? "line-clamp-2" : "line-clamp-3 sm:line-clamp-none"}`}>
                {item.body}
              </p>
            )}

            {item.imageUrl && (
              <img
                src={getAuthFileUrl(item.imageUrl)}
                alt={item.title || "Anuncio"}
                className="w-full max-h-48 object-contain rounded-lg border border-gray-100 mt-2"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}

            {item.attachmentUrl && (
              <a href={item.attachmentUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-2 text-xs text-seekop-600 hover:text-seekop-700 bg-seekop-50 px-2.5 py-1 rounded-lg">
                <Paperclip size={12} /> {item.attachmentName || "Adjunto"}
              </a>
            )}

            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
              <span className="flex items-center gap-1"><Clock size={12} /> {timeAgo(item.createdAt)}</span>
              {item.authorName && <span>por {item.authorName}</span>}
              <span className="flex items-center gap-1"><Eye size={12} /> {item.readCount} {item.readCount === 1 ? "visto" : "vistos"}</span>
            </div>

            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {REACTION_EMOJIS.map((emoji) => {
                const r = item.reactions?.find((rx) => rx.emoji === emoji);
                const myReacted = item.myReactions?.includes(emoji);
                return (
                  <button key={emoji} onClick={() => reactionMut.mutate({ id: item.id, emoji })}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                      myReacted ? "bg-seekop-50 border-seekop-300 text-seekop-700" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                    }`} title={r?.userNames?.join(", ") || ""}>
                    <span>{emoji}</span>
                    {r && r.count > 0 && <span className="font-medium">{r.count}</span>}
                  </button>
                );
              })}
              {item.requiresAcknowledgment && !item.isAcknowledged && (
                <button onClick={() => acknowledgeMut.mutate(item.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors">
                  <CheckCircle size={12} /> Enterado
                </button>
              )}
              {item.requiresAcknowledgment && item.isAcknowledged && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  <CheckCircle size={12} /> Confirmado
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center gap-1 shrink-0">
            {canViewStats && onStatsClick && (
              <button onClick={() => onStatsClick(item.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Estadísticas"><BarChart3 size={15} /></button>
            )}
            {canPin && (
              <button onClick={() => pinMut.mutate(item.id)}
                className={`p-1.5 rounded-lg transition-colors ${item.isPinned ? "text-amber-500 hover:bg-amber-50" : "text-gray-400 hover:text-amber-500 hover:bg-amber-50"}`}
                title={item.isPinned ? "Desfijar" : "Fijar"}><Pin size={15} /></button>
            )}
            {canPin && (
              <button onClick={() => archiveMut.mutate(item.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-violet-500 hover:bg-violet-50 transition-colors" title="Archivar"><Archive size={15} /></button>
            )}
            <button onClick={() => dismissMut.mutate(item.id)} className="p-1.5 rounded-lg text-slate-300 hover:text-orange-500 hover:bg-orange-50 transition-colors" title="Ocultar"><X size={15} /></button>
            {canDelete && (
              <button onClick={() => setDeleteTarget({ id: item.id, title: item.title || "Sin título" })} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Eliminar"><Trash2 size={15} /></button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-seekop-50 flex items-center justify-center">
              <Megaphone size={18} className="text-seekop-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 leading-tight">Anuncios del equipo</h3>
              <p className="text-[11px] text-slate-400">
                {total} anuncio{total !== 1 ? "s" : ""}
                {typeFilter ? ` filtrados` : ""}
                {unreadCount > 0 ? ` · ${unreadCount} sin leer` : ""}
              </p>
            </div>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-red-500 text-white rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setViewMode((v) => v === "carousel" ? "list" : "carousel")}
              className="p-1.5 text-slate-400 hover:text-seekop-600 hover:bg-seekop-50 rounded-lg transition-colors border border-transparent hover:border-seekop-200"
              title={viewMode === "carousel" ? "Ver como lista" : "Ver como carrusel"}
            >
              {viewMode === "carousel" ? <LayoutList size={15} /> : <LayoutGrid size={15} />}
            </button>
            <button
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-seekop-600 hover:bg-seekop-50 rounded-lg transition-colors border border-transparent hover:border-seekop-200"
            >
              <History size={14} />
              Historial
            </button>
            {canCreate && onCreateClick && (
              <button
                onClick={onCreateClick}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-seekop-600 hover:bg-seekop-700 rounded-lg transition-colors shadow-sm"
              >
                <Megaphone size={13} />
                Nuevo
              </button>
            )}
          </div>
        </div>

        {/* Filter chips */}
        {allItems.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {TYPE_FILTERS.map((f) => {
              const count = f.value ? allItems.filter((i) => i.type === f.value).length : allItems.length;
              if (f.value && count === 0) return null;
              return (
                <button
                  key={f.value}
                  onClick={() => setTypeFilter(f.value)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                    typeFilter === f.value
                      ? "bg-seekop-600 text-white border-seekop-600 shadow-sm"
                      : "bg-white text-slate-500 border-slate-200 hover:border-seekop-300 hover:text-seekop-600"
                  }`}
                >
                  {f.label}
                  <span className={`text-[10px] font-bold px-1 rounded-full ${typeFilter === f.value ? "bg-white/20 text-white" : "bg-slate-100 text-slate-400"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-6">
            <div className="animate-spin h-5 w-5 border-2 border-seekop-500 border-t-transparent rounded-full" />
          </div>
        )}

        {/* Empty */}
        {!isLoading && total === 0 && (
          <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl bg-white/50">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Megaphone size={20} className="text-slate-300" />
            </div>
            <p className="text-xs font-medium text-slate-400">
              {typeFilter ? "No hay anuncios de este tipo" : "No hay anuncios por el momento"}
            </p>
          </div>
        )}

        {/* ── CAROUSEL VIEW ── */}
        {!isLoading && ann && viewMode === "carousel" && (
          <div
            className="relative"
            onMouseEnter={() => { setIsPaused(true); if (!ann.isRead) markReadMut.mutate(ann.id); }}
            onMouseLeave={() => setIsPaused(false)}
          >
            <div className="relative overflow-hidden rounded-2xl">
              <AnnouncementCard item={ann} />

              {/* Progress bar */}
              {total > 1 && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-100 rounded-b-2xl overflow-hidden">
                  <div
                    className="h-full bg-seekop-400 transition-none"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              )}
            </div>

            {/* Prev/next — desktop */}
            {total > 1 && (
              <>
                <button
                  onClick={goPrev}
                  className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 sm:-translate-x-3 bg-white border border-slate-200 shadow-md rounded-full p-2 sm:p-1.5 text-slate-400 hover:text-seekop-600 hover:border-seekop-300 hover:shadow-lg transition-all z-10"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={goNext}
                  className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 sm:translate-x-3 bg-white border border-slate-200 shadow-md rounded-full p-2 sm:p-1.5 text-slate-400 hover:text-seekop-600 hover:border-seekop-300 hover:shadow-lg transition-all z-10"
                >
                  <ChevronRight size={14} />
                </button>
              </>
            )}
          </div>
        )}

        {/* Mobile nav row — carousel only */}
        {!isLoading && ann && viewMode === "carousel" && total > 1 && (
          <div className="sm:hidden flex items-center justify-center gap-3 mt-2">
            <button onClick={goPrev} className="p-2.5 bg-white border border-slate-200 shadow-sm rounded-full text-slate-400 hover:text-seekop-600 hover:border-seekop-300 transition-all">
              <ChevronLeft size={14} />
            </button>
            <div className="flex items-center gap-1.5">
              {filteredItems.map((_, i) => (
                <button key={i} onClick={() => setSlideIndex(i)}
                  className={`rounded-full transition-all ${i === slideIndex ? "w-5 h-1.5 bg-seekop-500" : "w-1.5 h-1.5 bg-gray-300 hover:bg-gray-400"}`}
                />
              ))}
            </div>
            <button onClick={goNext} className="p-2.5 bg-white border border-slate-200 shadow-sm rounded-full text-slate-400 hover:text-seekop-600 hover:border-seekop-300 transition-all">
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* Dots — desktop, carousel only */}
        {!isLoading && viewMode === "carousel" && total > 1 && (
          <div className="hidden sm:flex items-center justify-center gap-1.5 pt-1">
            {filteredItems.map((_, i) => (
              <button key={i} onClick={() => setSlideIndex(i)}
                className={`rounded-full transition-all ${i === slideIndex ? "w-5 h-1.5 bg-seekop-500" : "w-1.5 h-1.5 bg-gray-300 hover:bg-gray-400"}`}
              />
            ))}
          </div>
        )}

        {/* ── LIST VIEW ── */}
        {!isLoading && viewMode === "list" && total > 0 && (
          <div className="space-y-2.5">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="relative"
                onMouseEnter={() => { if (!item.isRead) markReadMut.mutate(item.id); }}
              >
                <AnnouncementCard item={item} compact />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="¿Eliminar este anuncio?"
        description={`Se eliminará "${deleteTarget?.title}" de forma permanente. Esta acción no se puede deshacer.`}
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={() => { if (deleteTarget) deleteMut.mutate(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* History Modal */}
      <AnnouncementHistoryModal
        open={showHistory}
        onClose={() => setShowHistory(false)}
        canPin={canPin}
        canDelete={canDelete}
        canViewStats={canViewStats}
        onStatsClick={onStatsClick}
      />
    </>
  );
}
