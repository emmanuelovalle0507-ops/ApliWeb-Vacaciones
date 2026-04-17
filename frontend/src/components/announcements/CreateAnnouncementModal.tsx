"use client";

import React, { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, AlertTriangle, PartyPopper, X, Pin, Globe, Send, Clock, CheckCircle, Paperclip, ImagePlus, Trash2, Loader2 } from "lucide-react";
import api from "@/api/client";
import { useAuth } from "@/providers/AuthProvider";
import type { AnnouncementType } from "@/types";
import { useToast } from "@/components/ui/Toast";

const TYPES: { value: AnnouncementType; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: "GENERAL", label: "General", icon: <Megaphone size={16} />, desc: "Comunicado informativo" },
  { value: "URGENT", label: "Urgente", icon: <AlertTriangle size={16} />, desc: "Aviso importante o urgente" },
  { value: "CELEBRATION", label: "Celebración", icon: <PartyPopper size={16} />, desc: "Logro, cumpleaños, evento" },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CreateAnnouncementModal({ open, onClose }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [type, setType] = useState<AnnouncementType>("GENERAL");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [isPinned, setIsPinned] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [publishAt, setPublishAt] = useState("");
  const [requiresAcknowledgment, setRequiresAcknowledgment] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isManager = user?.role === "MANAGER";
  const canSelectTeams = user?.role === "HR" || user?.role === "ADMIN";

  const teamsQ = useQuery({
    queryKey: ["admin.teams"],
    queryFn: () => api.admin.teams.list(),
    enabled: canSelectTeams && open,
  });

  async function handleImageSelect(file: File) {
    if (!file.type.startsWith("image/")) {
      toast("error", "Solo se permiten imágenes (JPEG, PNG, WebP)");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast("error", "La imagen no puede superar 10 MB");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setIsUploading(true);
    try {
      const result = await api.announcements.uploadImage(file);
      setImageUrl(result.url);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Error al subir imagen");
      setImageFile(null);
      setImagePreview(null);
    } finally {
      setIsUploading(false);
    }
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview(null);
    setImageUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const createMut = useMutation({
    mutationFn: () => {
      let teamIds: string[] = [];
      if (isManager) {
        teamIds = user?.area?.id ? [user.area.id] : [];
      } else if (!isBroadcast) {
        teamIds = selectedTeamIds;
      }
      return api.announcements.create({
        type,
        title,
        body,
        teamIds,
        isPinned,
        expiresAt: expiresAt || undefined,
        publishAt: publishAt || undefined,
        requiresAcknowledgment,
        attachmentUrl: attachmentUrl || undefined,
        attachmentName: attachmentName || undefined,
        imageUrl: imageUrl || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements"] });
      qc.invalidateQueries({ queryKey: ["announcements.pinned"] });
      qc.invalidateQueries({ queryKey: ["announcements.unreadCount"] });
      qc.invalidateQueries({ queryKey: ["announcements.history"] });
      qc.invalidateQueries({ queryKey: ["announcements.history.search"] });
      toast("success", "Anuncio publicado correctamente");
      resetForm();
      onClose();
    },
    onError: (err) => {
      toast("error", err instanceof Error ? err.message : "Error al crear anuncio");
    },
  });

  function resetForm() {
    setType("GENERAL");
    setTitle("");
    setBody("");
    setSelectedTeamIds([]);
    setIsPinned(false);
    setExpiresAt("");
    setIsBroadcast(false);
    setPublishAt("");
    setRequiresAcknowledgment(false);
    setAttachmentUrl("");
    setAttachmentName("");
    setImageFile(null);
    setImagePreview(null);
    setImageUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function toggleTeam(id: string) {
    setSelectedTeamIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  if (!open || !mounted) return null;

  const hasImage = !!imageUrl;
  const canSubmit = (title.trim().length > 0 && body.trim().length > 0) || (hasImage && !isUploading);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-seekop-50 text-seekop-600">
              <Megaphone size={20} />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Nuevo Anuncio</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Type selector */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Tipo de anuncio</label>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
                    type === t.value
                      ? "border-seekop-500 bg-seekop-50 text-seekop-700"
                      : "border-gray-200 hover:border-gray-300 text-gray-500"
                  }`}
                >
                  {t.icon}
                  <span className="text-xs font-semibold">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Image Upload */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Imagen / Flyer (opcional)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImageSelect(f);
              }}
            />
            {!imagePreview ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleImageSelect(f);
                }}
                className="w-full flex flex-col items-center gap-2 p-6 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 hover:border-seekop-400 hover:text-seekop-500 transition-colors cursor-pointer"
              >
                <ImagePlus size={28} />
                <span className="text-xs font-medium">Arrastra una imagen o haz clic para seleccionar</span>
                <span className="text-[10px]">JPEG, PNG o WebP · máx. 10 MB</span>
              </button>
            ) : (
              <div className="relative group">
                <img
                  src={imagePreview}
                  alt="Vista previa"
                  className="w-full max-h-48 object-contain rounded-xl border border-gray-200"
                />
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-xl">
                    <Loader2 size={24} className="animate-spin text-seekop-600" />
                    <span className="ml-2 text-sm text-seekop-600 font-medium">Subiendo...</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
                >
                  <Trash2 size={14} />
                </button>
                {imageFile && (
                  <p className="text-xs text-gray-500 mt-1 text-center">{imageFile.name}</p>
                )}
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Título {hasImage ? '(opcional)' : ''}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Ej: Reunión de equipo este viernes"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-seekop-500 focus:border-seekop-500 outline-none"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{title.length}/200</p>
          </div>

          {/* Body */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Mensaje {hasImage ? '(opcional)' : ''}</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
              rows={hasImage ? 2 : 4}
              placeholder={hasImage ? "Descripción opcional del flyer..." : "Escribe el contenido del anuncio..."}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-seekop-500 focus:border-seekop-500 outline-none resize-none"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{body.length}/2000</p>
          </div>

          {/* Team selection (HR/Admin only) */}
          {canSelectTeams && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Audiencia</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isBroadcast}
                    onChange={(e) => {
                      setIsBroadcast(e.target.checked);
                      if (e.target.checked) setSelectedTeamIds([]);
                    }}
                    className="rounded border-gray-300 text-seekop-600 focus:ring-seekop-500"
                  />
                  <Globe size={14} className="text-gray-400" />
                  <span className="text-sm text-gray-700">Toda la empresa</span>
                </label>
                {!isBroadcast && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(teamsQ.data ?? []).map((team) => (
                      <button
                        key={team.id}
                        onClick={() => toggleTeam(team.id)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                          selectedTeamIds.includes(team.id)
                            ? "bg-seekop-50 border-seekop-300 text-seekop-700"
                            : "bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        {team.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Manager: team info */}
          {isManager && (
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
              <p className="text-xs text-gray-500">
                Este anuncio se publicará en tu equipo: <strong>{user?.area?.name ?? "—"}</strong>
              </p>
            </div>
          )}

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="rounded border-gray-300 text-seekop-600 focus:ring-seekop-500"
                />
                <Pin size={14} className="text-gray-400" />
                <span className="text-sm text-gray-700">Fijar arriba</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiresAcknowledgment}
                  onChange={(e) => setRequiresAcknowledgment(e.target.checked)}
                  className="rounded border-gray-300 text-seekop-600 focus:ring-seekop-500"
                />
                <CheckCircle size={14} className="text-gray-400" />
                <span className="text-sm text-gray-700">Requiere confirmación</span>
              </label>
            </div>

            {/* Dates row */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700">Expira:</label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="px-2 py-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-seekop-500 outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-gray-400" />
                <label className="text-sm text-gray-700">Programar:</label>
                <input
                  type="datetime-local"
                  value={publishAt}
                  onChange={(e) => setPublishAt(e.target.value)}
                  className="px-2 py-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-seekop-500 outline-none"
                />
              </div>
            </div>

            {/* Attachment */}
            <div className="flex items-center gap-2">
              <Paperclip size={14} className="text-gray-400" />
              <input
                type="url"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                placeholder="URL del adjunto (opcional)"
                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-seekop-500 outline-none"
              />
              <input
                type="text"
                value={attachmentName}
                onChange={(e) => setAttachmentName(e.target.value)}
                placeholder="Nombre"
                className="w-28 px-2 py-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-seekop-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-5 border-t">
          <button
            onClick={() => { resetForm(); onClose(); }}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => createMut.mutate()}
            disabled={!canSubmit || createMut.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-seekop-600 hover:bg-seekop-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <Send size={14} />
            {createMut.isPending ? "Publicando..." : publishAt ? "Programar" : "Publicar"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
