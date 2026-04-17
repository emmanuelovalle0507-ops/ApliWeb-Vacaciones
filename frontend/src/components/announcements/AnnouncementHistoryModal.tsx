"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Megaphone,
  UserPlus,
  AlertTriangle,
  PartyPopper,
  Eye,
  EyeOff,
  Pin,
  PinOff,
  Trash2,
  BarChart3,
  Clock,
  CheckCircle,
  Globe,
  X,
  RotateCcw,
  Search,
  Paperclip,
  Archive,
  Users,
} from "lucide-react";
import api from "@/api/client";
import { useAuth } from "@/providers/AuthProvider";
import type { Announcement, AnnouncementType } from "@/types";
import { useToast } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

function getAuthFileUrl(url: string): string {
  if (!url) return "";
  const token = typeof window !== "undefined" ? localStorage.getItem("vc_token") : null;
  return token ? `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}` : url;
}

const TYPE_CONFIG: Record<
  AnnouncementType,
  { icon: React.ReactNode; label: string; color: string; border: string; bg: string; accent: string }
> = {
  NEW_EMPLOYEE: {
    icon: <UserPlus size={15} />,
    label: "Nuevo integrante",
    color: "text-emerald-700",
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    accent: "border-l-emerald-400",
  },
  URGENT: {
    icon: <AlertTriangle size={15} />,
    label: "Urgente",
    color: "text-red-700",
    border: "border-red-200",
    bg: "bg-red-50",
    accent: "border-l-red-400",
  },
  CELEBRATION: {
    icon: <PartyPopper size={15} />,
    label: "Celebración",
    color: "text-amber-700",
    border: "border-amber-200",
    bg: "bg-amber-50",
    accent: "border-l-amber-400",
  },
  GENERAL: {
    icon: <Megaphone size={15} />,
    label: "General",
    color: "text-blue-700",
    border: "border-blue-200",
    bg: "bg-blue-50",
    accent: "border-l-blue-400",
  },
};

const TYPE_FILTERS = [
  { value: "", label: "Todos" },
  { value: "URGENT", label: "Urgentes" },
  { value: "NEW_EMPLOYEE", label: "Bienvenidas" },
  { value: "CELEBRATION", label: "Celebraciones" },
  { value: "GENERAL", label: "Generales" },
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
  return new Date(dateStr).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

interface Props {
  open: boolean;
  onClose: () => void;
  canPin?: boolean;
  canDelete?: boolean;
  canViewStats?: boolean;
  onStatsClick?: (id: string) => void;
}

export default function AnnouncementHistoryModal({
  open,
  onClose,
  canPin = false,
  canDelete = false,
  canViewStats = false,
  onStatsClick,
}: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [typeFilter, setTypeFilter] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const markReadTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["announcements"] });
    qc.invalidateQueries({ queryKey: ["announcements.pinned"] });
    qc.invalidateQueries({ queryKey: ["announcements.unreadCount"] });
    qc.invalidateQueries({ queryKey: ["announcements.history"] });
    qc.invalidateQueries({ queryKey: ["announcements.history.search"] });
  };

  const { data, isLoading } = useQuery({
    queryKey: ["announcements.history", user?.id, typeFilter, showHidden],
    queryFn: () => api.announcements.listMine(typeFilter || undefined, undefined, showHidden),
    enabled: !!user && open && !searchQuery,
  });

  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["announcements.history.search", searchQuery],
    queryFn: () => api.announcements.search(searchQuery),
    enabled: !!searchQuery && searchQuery.length >= 2 && open,
  });

  const markReadMut = useMutation({
    mutationFn: (id: string) => api.announcements.markRead(id),
    onSuccess: () => invalidateAll(),
  });
  const pinMut = useMutation({
    mutationFn: (id: string) => api.announcements.togglePin(id),
    onSuccess: () => { invalidateAll(); toast("success", "Pin actualizado"); },
    onError: (err) => toast("error", err instanceof Error ? err.message : "Error al fijar"),
  });
  const dismissMut = useMutation({
    mutationFn: (id: string) => api.announcements.dismiss(id),
    onSuccess: () => { invalidateAll(); toast("success", "Anuncio ocultado"); },
    onError: (err) => toast("error", err instanceof Error ? err.message : "Error"),
  });
  const undismissMut = useMutation({
    mutationFn: (id: string) => api.announcements.undismiss(id),
    onSuccess: () => { invalidateAll(); toast("success", "Anuncio restaurado"); },
    onError: (err) => toast("error", err instanceof Error ? err.message : "Error"),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.announcements.delete(id),
    onSuccess: () => { setDeleteTarget(null); invalidateAll(); toast("success", "Anuncio eliminado"); },
    onError: (err) => toast("error", err instanceof Error ? err.message : "Error al eliminar"),
  });
  const reactionMut = useMutation({
    mutationFn: ({ id, emoji }: { id: string; emoji: string }) => api.announcements.toggleReaction(id, emoji),
    onSuccess: () => invalidateAll(),
  });
  const acknowledgeMut = useMutation({
    mutationFn: (id: string) => api.announcements.acknowledge(id),
    onSuccess: () => { invalidateAll(); toast("success", "Confirmado"); },
    onError: (err) => toast("error", err instanceof Error ? err.message : "Error"),
  });
  const archiveMut = useMutation({
    mutationFn: (id: string) => api.announcements.archive(id),
    onSuccess: () => { invalidateAll(); toast("success", "Anuncio archivado"); },
    onError: (err) => toast("error", err instanceof Error ? err.message : "Error"),
  });

  // Mark as read after 1.5s of visible hover — avoids spam on quick passes
  const handleCardEnter = (ann: Announcement) => {
    if (ann.isRead) return;
    markReadTimers.current[ann.id] = setTimeout(() => {
      markReadMut.mutate(ann.id);
    }, 1500);
  };
  const handleCardLeave = (id: string) => {
    clearTimeout(markReadTimers.current[id]);
    delete markReadTimers.current[id];
  };

  const items: Announcement[] = searchQuery && searchResults
    ? (searchResults as unknown as Announcement[])
    : (data?.items ?? []);

  const unreadCount = items.filter((a) => !a.isRead).length;
  const loading = isLoading || isSearching;

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white w-full sm:rounded-2xl shadow-2xl sm:max-w-3xl flex flex-col max-h-[92vh] sm:max-h-[85vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-seekop-50 rounded-xl">
              <Megaphone size={18} className="text-seekop-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Historial de anuncios</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {loading ? "Cargando..." : `${items.length} anuncio${items.length !== 1 ? "s" : ""}${unreadCount > 0 ? ` · ${unreadCount} sin leer` : ""}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b bg-gray-50 shrink-0 space-y-2.5">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en anuncios..."
              className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-seekop-400 focus:border-transparent placeholder-gray-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filters row */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 flex-wrap">
              {TYPE_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setTypeFilter(f.value)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                    typeFilter === f.value
                      ? "bg-seekop-600 text-white shadow-sm"
                      : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowHidden(!showHidden)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-all ${
                showHidden
                  ? "bg-orange-50 border-orange-200 text-orange-700"
                  : "bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {showHidden ? <Eye size={13} /> : <EyeOff size={13} />}
              {showHidden ? "Ver todos" : "Mostrar ocultos"}
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="animate-spin h-6 w-6 border-2 border-seekop-500 border-t-transparent rounded-full" />
              <p className="text-sm text-gray-400">Cargando anuncios...</p>
            </div>
          )}

          {/* Empty state */}
          {!loading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="p-4 bg-gray-100 rounded-2xl">
                <Megaphone size={28} className="text-gray-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">
                  {searchQuery ? "Sin resultados para tu búsqueda" : showHidden ? "No hay anuncios ocultos" : "No hay anuncios por el momento"}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {searchQuery ? "Intenta con otras palabras" : "Los nuevos anuncios aparecerán aquí"}
                </p>
              </div>
            </div>
          )}

          {/* Announcement cards */}
          {!loading && items.map((ann: Announcement) => {
            const cfg = TYPE_CONFIG[ann.type] ?? TYPE_CONFIG.GENERAL;
            const isExpanded = expandedId === ann.id;

            return (
              <div
                key={ann.id}
                onMouseEnter={() => handleCardEnter(ann)}
                onMouseLeave={() => handleCardLeave(ann.id)}
                className={`relative border rounded-xl transition-all duration-200 overflow-hidden border-l-4 ${cfg.border} ${cfg.accent} ${
                  ann.isRead ? "bg-white" : cfg.bg
                } hover:shadow-md`}
              >
                {/* Pinned ribbon */}
                {ann.isPinned && (
                  <div className="absolute top-0 right-0 bg-amber-400 text-white text-[10px] font-semibold px-2 py-0.5 rounded-bl-lg flex items-center gap-1">
                    <Pin size={9} /> Fijado
                  </div>
                )}

                <div className="p-4">
                  {/* Top row: type badge + meta + unread dot */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                      {ann.isBroadcast ? (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                          <Globe size={11} /> Toda la empresa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                          <Users size={11} /> Equipo
                        </span>
                      )}
                      {!ann.isRead && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-200">
                          ● Nuevo
                        </span>
                      )}
                    </div>

                    {/* Admin/Manager actions */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      {canViewStats && onStatsClick && (
                        <button
                          onClick={() => onStatsClick(ann.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Ver estadísticas"
                        >
                          <BarChart3 size={14} />
                        </button>
                      )}
                      {canPin && (
                        <button
                          onClick={() => pinMut.mutate(ann.id)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            ann.isPinned
                              ? "text-amber-500 hover:bg-amber-50"
                              : "text-gray-400 hover:text-amber-500 hover:bg-amber-50"
                          }`}
                          title={ann.isPinned ? "Desfijar" : "Fijar anuncio"}
                        >
                          {ann.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                        </button>
                      )}
                      {canPin && (
                        <button
                          onClick={() => archiveMut.mutate(ann.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-violet-500 hover:bg-violet-50 transition-colors"
                          title="Archivar"
                        >
                          <Archive size={14} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => setDeleteTarget({ id: ann.id, title: ann.title || "Sin título" })}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Eliminar permanentemente"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Title & body */}
                  {ann.title && (
                    <h4 className="text-sm font-semibold text-gray-900 mb-1 leading-snug">{ann.title}</h4>
                  )}
                  {ann.body && (
                    <p
                      className={`text-sm text-gray-600 leading-relaxed ${isExpanded ? "" : "line-clamp-3"}`}
                    >
                      {ann.body}
                    </p>
                  )}
                  {ann.body && ann.body.length > 180 && (
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : ann.id)}
                      className="text-xs text-seekop-600 hover:text-seekop-700 font-medium mt-1"
                    >
                      {isExpanded ? "Ver menos" : "Ver más"}
                    </button>
                  )}

                  {/* Image */}
                  {ann.imageUrl && (
                    <img
                      src={getAuthFileUrl(ann.imageUrl)}
                      alt={ann.title || "Imagen del anuncio"}
                      className="w-full max-h-48 object-contain rounded-xl border border-gray-100 mt-3 bg-gray-50"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}

                  {/* Attachment */}
                  {ann.attachmentUrl && (
                    <a
                      href={ann.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 text-xs text-seekop-600 bg-seekop-50 hover:bg-seekop-100 border border-seekop-200 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      <Paperclip size={12} />
                      {(ann as unknown as { attachmentName?: string }).attachmentName || "Ver adjunto"}
                    </a>
                  )}

                  {/* Footer: meta + reactions + visibility */}
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">

                    {/* Left: meta */}
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {timeAgo(ann.createdAt)}
                      </span>
                      {ann.authorName && <span>por <span className="text-gray-600 font-medium">{ann.authorName}</span></span>}
                      <span className="flex items-center gap-1">
                        <Eye size={11} />
                        {ann.readCount ?? 0}
                      </span>
                    </div>

                    {/* Right: reactions + acknowledge + hide */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {REACTION_EMOJIS.map((emoji) => {
                        const r = ann.reactions?.find((rx) => rx.emoji === emoji);
                        const mine = ann.myReactions?.includes(emoji);
                        return (
                          <button
                            key={emoji}
                            onClick={() => reactionMut.mutate({ id: ann.id, emoji })}
                            className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-sm border transition-all ${
                              mine
                                ? "bg-seekop-50 border-seekop-300 text-seekop-700 shadow-sm"
                                : "bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            {emoji}
                            {r && r.count > 0 && (
                              <span className="text-[10px] font-semibold ml-0.5">{r.count}</span>
                            )}
                          </button>
                        );
                      })}

                      {ann.requiresAcknowledgment && !ann.isAcknowledged && (
                        <button
                          onClick={() => acknowledgeMut.mutate(ann.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 border border-orange-200 transition-colors"
                        >
                          <CheckCircle size={12} /> Enterado
                        </button>
                      )}
                      {ann.requiresAcknowledgment && ann.isAcknowledged && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                          <CheckCircle size={12} /> Confirmado
                        </span>
                      )}

                      {/* Hide/Restore — clearly labeled */}
                      {showHidden ? (
                        <button
                          onClick={() => undismissMut.mutate(ann.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-gray-500 hover:text-green-700 hover:bg-green-50 border border-gray-200 hover:border-green-200 transition-colors"
                          title="Restaurar anuncio"
                        >
                          <RotateCcw size={12} /> Restaurar
                        </button>
                      ) : (
                        <button
                          onClick={() => dismissMut.mutate(ann.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-gray-500 hover:text-orange-700 hover:bg-orange-50 border border-gray-200 hover:border-orange-200 transition-colors"
                          title="Ocultar de la lista"
                        >
                          <EyeOff size={12} /> Ocultar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="¿Eliminar este anuncio?"
        description={`Se eliminará "${deleteTarget?.title}" de forma permanente. Esta acción no se puede deshacer.`}
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={() => { if (deleteTarget) deleteMut.mutate(deleteTarget.id); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>,
    document.body
  );
}
