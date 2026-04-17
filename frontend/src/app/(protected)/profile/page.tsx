"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  User as UserIcon,
  Mail,
  Shield,
  Users,
  Briefcase,
  CalendarDays,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Building2,
  Phone,
  HeartPulse,
  Crown,
  Palmtree,
  Clock,
  Save,
  Pencil,
  X,
  Camera,
  ChevronDown,
  ChevronUp,
  Plane,
} from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import api from "@/api/client";
import Button from "@/components/ui/Button";
import { ROLE_LABELS } from "@/types";
import type { TeamInfo, VacationRequest } from "@/types";
import { useToast } from "@/components/ui/Toast";

// ── Avatar gradient helpers ────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "from-blue-500 to-blue-600",
  "from-emerald-500 to-emerald-600",
  "from-violet-500 to-violet-600",
  "from-amber-500 to-amber-600",
  "from-rose-500 to-rose-600",
  "from-cyan-500 to-cyan-600",
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function avatarGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtDateShort(iso: string): string {
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const [, m, d] = iso.split("-");
  return `${parseInt(d)} ${months[parseInt(m) - 1]}`;
}

function getTenure(hireDate: string): string {
  const hire = new Date(hireDate + "T12:00:00");
  const now = new Date();
  let years = now.getFullYear() - hire.getFullYear();
  let months = now.getMonth() - hire.getMonth();
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? "año" : "años"}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? "mes" : "meses"}`);
  if (parts.length === 0) return "Recién ingresado";
  return parts.join(", ");
}

function todayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | undefined | null;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gray-50 text-gray-400 shrink-0">
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <p className="text-sm font-medium text-gray-800 truncate">
          {value || <span className="text-gray-300">Sin asignar</span>}
        </p>
      </div>
    </div>
  );
}

function PasswordRule({ label, met }: { label: string; met: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {met ? (
        <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
      ) : (
        <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 shrink-0" />
      )}
      <span className={met ? "text-emerald-700" : "text-gray-400"}>{label}</span>
    </div>
  );
}

// ── Skeleton components ───────────────────────────────────────────────────────

function BalanceSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-3 bg-gray-100 rounded-full w-1/2" />
      <div className="h-3 bg-gray-100 rounded-full w-full" />
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function TeamSkeleton() {
  return (
    <div className="space-y-2.5 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-2.5 p-2">
          <div className="w-8 h-8 rounded-lg bg-gray-100 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-gray-100 rounded-full w-3/4" />
            <div className="h-2.5 bg-gray-100 rounded-full w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ContactSkeleton() {
  return (
    <div className="space-y-1 animate-pulse divide-y divide-gray-50">
      {[0, 1].map((i) => (
        <div key={i} className="flex items-start gap-3 py-3">
          <div className="w-9 h-9 rounded-xl bg-gray-100 shrink-0" />
          <div className="flex-1 space-y-1.5 pt-1">
            <div className="h-2.5 bg-gray-100 rounded-full w-1/4" />
            <div className="h-3 bg-gray-100 rounded-full w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Password Modal ────────────────────────────────────────────────────────────

interface PasswordModalProps {
  onClose: () => void;
}

function PasswordModal({ onClose }: PasswordModalProps) {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const rules = [
    { label: "Mínimo 8 caracteres", met: newPassword.length >= 8 },
    { label: "Al menos una mayúscula", met: /[A-Z]/.test(newPassword) },
    { label: "Al menos un número", met: /\d/.test(newPassword) },
    { label: "Las contraseñas coinciden", met: newPassword.length > 0 && newPassword === confirmPassword },
    { label: "Diferente a la actual", met: newPassword.length > 0 && newPassword !== currentPassword },
  ];
  const allMet = rules.every((r) => r.met) && currentPassword.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allMet) return;
    setError("");
    setLoading(true);
    try {
      await api.auth.changePassword(currentPassword, newPassword);
      toast("success", "Contraseña actualizada correctamente");
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al cambiar contraseña");
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Cerrar"
        >
          <X size={20} />
        </button>

        <h3 className="text-base font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <Lock size={16} className="text-seekop-500" />
          Cambiar contraseña
        </h3>
        <p className="text-xs text-gray-400 mb-5">Elige una contraseña segura que no hayas usado antes</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña actual</label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-seekop-400/30 focus:border-seekop-500 outline-none"
                placeholder="Tu contraseña actual"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nueva contraseña</label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-seekop-400/30 focus:border-seekop-500 outline-none"
                placeholder="Tu nueva contraseña"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                tabIndex={-1}
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar contraseña</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-seekop-400/30 focus:border-seekop-500 outline-none"
              placeholder="Repite tu nueva contraseña"
            />
          </div>

          {/* Rules */}
          <div className="space-y-2 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Requisitos</p>
            {rules.map((r, i) => (
              <PasswordRule key={i} label={r.label} met={r.met} />
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <Button type="submit" variant="primary" className="w-full" disabled={!allMet} loading={loading}>
            Actualizar contraseña
          </Button>
        </form>
      </div>
    </div>,
    document.body,
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // SSR safety for portal
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Modal / UI state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [phone, setPhone] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [showAllTeam, setShowAllTeam] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const balanceQ = useQuery({
    queryKey: ["balance", user?.id, new Date().getFullYear()],
    queryFn: () => api.balance.getMyBalance(user!.id, new Date().getFullYear()),
    enabled: !!user,
  });

  const profileQ = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => api.profile.get(),
    enabled: !!user,
  });

  const teamQ = useQuery({
    queryKey: ["team-info", user?.id],
    queryFn: () => api.profile.teamInfo(),
    enabled: !!user,
  });

  const upcomingQ = useQuery({
    queryKey: ["my-upcoming-requests", user?.id],
    queryFn: () => api.requests.listMine(user!.id, undefined, { status: "APPROVED" }),
    enabled: !!user,
  });

  // Sync editable fields from profile query
  useEffect(() => {
    if (profileQ.data) {
      setPhone(profileQ.data.phone || "");
      setEmergencyContact(profileQ.data.emergency_contact || "");
    }
  }, [profileQ.data]);

  if (!user) return null;

  // ── Derived data ─────────────────────────────────────────────────────────────

  const balance = balanceQ.data;
  const team: TeamInfo | undefined = teamQ.data;
  const today = todayStr();

  // Filter upcoming vacations: active today or start in the future
  const upcomingVacations: VacationRequest[] = (upcomingQ.data?.items ?? [])
    .filter((r) => r.startDate >= today || r.endDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 3);

  const activeToday = upcomingVacations.find((r) => r.startDate <= today && r.endDate >= today);

  // On-vacation IDs for quick lookup
  const onVacationNowIds = new Set((team?.on_vacation_now ?? []).map((v) => v.id));
  const upcomingVacationMap = new Map(
    (team?.upcoming_vacations ?? []).map((v) => [v.id, v]),
  );

  const allTeamMembers = team?.team_members ?? [];
  const visibleTeamMembers = showAllTeam ? allTeamMembers : allTeamMembers.slice(0, 6);

  const hireDateFormatted = user.hireDate
    ? new Date(user.hireDate + "T12:00:00").toLocaleDateString("es-MX", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const tenure = user.hireDate ? getTenure(user.hireDate) : null;

  async function handleSaveProfile() {
    setSavingProfile(true);
    try {
      await api.profile.update({ phone: phone || null, emergency_contact: emergencyContact || null });
      toast("success", "Perfil actualizado correctamente");
      setEditingProfile(false);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSavingProfile(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ── Header banner ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl shadow-sm border border-gray-100 overflow-hidden bg-gradient-to-br from-[#001a4f] via-[#002a7f] to-[#003da8] relative">
        {/* Geometric wave pattern */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="profile-grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 60" stroke="white" strokeWidth="0.5" fill="none" />
              <path d="M 30 0 L 0 30" stroke="white" strokeWidth="0.5" fill="none" />
              <path d="M 60 30 L 30 60" stroke="white" strokeWidth="0.5" fill="none" />
              <circle cx="0" cy="0" r="1.5" fill="white" />
              <circle cx="60" cy="60" r="1.5" fill="white" />
              <circle cx="30" cy="30" r="1" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#profile-grid)" />
        </svg>
        {/* Accent glow */}
        <div className="absolute -top-10 -right-10 w-60 h-60 bg-[#9ab236]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-10 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        {/* Seekop logo watermark */}
        <div className="absolute right-6 top-6 opacity-[0.10] pointer-events-none">
          <img
            src="/branding/seekop-logo.png"
            alt=""
            className="h-16 sm:h-20 object-contain brightness-0 invert"
          />
        </div>
        {/* Seekop Consulting text */}
        <div className="absolute left-8 top-4 sm:top-5 pointer-events-none">
          <p className="text-[10px] sm:text-xs font-semibold text-white/40 uppercase tracking-[0.2em]">
            Seekop Consulting
          </p>
        </div>

        {/* User info */}
        <div className="px-6 sm:px-8 py-8 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-end gap-5">
            {/* Avatar with hover overlay */}
            <div className="relative group shrink-0">
              <div
                className={`flex items-center justify-center w-[88px] h-[88px] sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br ${avatarGradient(user.id)} text-white text-3xl font-bold shadow-xl border-4 border-white ring-4 ring-white/50`}
              >
                {getInitials(user.fullName)}
              </div>
              {/* Camera overlay */}
              <div className="group-hover:flex hidden absolute inset-0 bg-black/40 rounded-2xl items-center justify-center flex-col cursor-pointer">
                <Camera size={20} className="text-white" />
                <span className="text-[10px] text-white mt-1">Cambiar foto</span>
              </div>
            </div>

            <div className="flex-1 pt-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-white truncate drop-shadow-sm">
                {user.fullName}
              </h1>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1.5">
                <span className="inline-flex items-center gap-1.5 text-sm text-white/70 truncate">
                  <Mail size={14} className="shrink-0" />
                  <span className="truncate">{user.email}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold bg-white/15 text-white rounded-full border border-white/20 backdrop-blur-sm">
                  <Shield size={12} /> {ROLE_LABELS[user.role]}
                </span>
              </div>
              {user.position && (
                <p className="text-sm text-white/50 mt-1.5 font-medium">{user.position}</p>
              )}
              {tenure && (
                <p className="text-xs text-white/60 mt-1 flex items-center gap-1.5">
                  <CalendarDays size={12} className="shrink-0" />
                  {tenure} en la empresa
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main 2-column grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left column (2/3) ───────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info Personal */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <UserIcon size={16} className="text-seekop-500" />
              Información Personal
            </h3>
            <p className="text-xs text-gray-400 mb-4">Datos de tu cuenta en el sistema</p>
            <div className="divide-y divide-gray-50">
              <InfoRow icon={Mail} label="Correo electrónico" value={user.email} />
              <InfoRow icon={Shield} label="Rol" value={ROLE_LABELS[user.role]} />
              <InfoRow icon={Building2} label="Equipo" value={user.area.name} />
              <InfoRow icon={Briefcase} label="Puesto" value={user.position} />
              <InfoRow icon={CalendarDays} label="Fecha de ingreso" value={hireDateFormatted} />
            </div>
          </div>

          {/* Datos de Contacto + Seguridad integrada */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Phone size={16} className="text-seekop-500" />
                Datos de Contacto
              </h3>
              {!editingProfile ? (
                <button
                  onClick={() => setEditingProfile(true)}
                  className="text-xs text-seekop-600 hover:text-seekop-700 flex items-center gap-1"
                >
                  <Pencil size={12} /> Editar
                </button>
              ) : (
                <button
                  onClick={() => {
                    setEditingProfile(false);
                    setPhone(profileQ.data?.phone || "");
                    setEmergencyContact(profileQ.data?.emergency_contact || "");
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                >
                  <X size={12} /> Cancelar
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 mb-4">Tu teléfono y contacto de emergencia</p>

            {profileQ.isLoading ? (
              <ContactSkeleton />
            ) : editingProfile ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+52 123 456 7890"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-seekop-400/30 focus:border-seekop-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Contacto de emergencia
                  </label>
                  <input
                    type="text"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder="Nombre — Tel: +52 ..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-seekop-400/30 focus:border-seekop-500 outline-none"
                  />
                </div>
                <Button onClick={handleSaveProfile} loading={savingProfile} variant="primary" className="w-full">
                  <Save size={14} className="mr-1.5" /> Guardar cambios
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                <InfoRow icon={Phone} label="Teléfono" value={profileQ.data?.phone} />
                <InfoRow icon={HeartPulse} label="Contacto de emergencia" value={profileQ.data?.emergency_contact} />
              </div>
            )}

            {/* Seguridad integrada */}
            <hr className="my-4 border-gray-100" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gray-50 text-gray-400 shrink-0">
                  <Lock size={17} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Contraseña</p>
                  <p className="text-xs text-gray-400">Seguridad de acceso</p>
                </div>
              </div>
              <button
                onClick={() => setShowPasswordModal(true)}
                className="text-xs px-3 py-1.5 bg-seekop-50 text-seekop-600 hover:bg-seekop-100 rounded-lg font-medium transition-colors"
              >
                Cambiar
              </button>
            </div>
          </div>

          {/* Mis Próximas Vacaciones */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Plane size={16} className="text-seekop-500" />
              Mis Próximas Vacaciones
            </h3>
            <p className="text-xs text-gray-400 mb-4">Vacaciones aprobadas activas y futuras</p>

            {upcomingQ.isLoading ? (
              <div className="space-y-2 animate-pulse">
                {[0, 1].map((i) => (
                  <div key={i} className="h-14 bg-gray-100 rounded-xl" />
                ))}
              </div>
            ) : upcomingVacations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Palmtree size={28} className="text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">No tienes vacaciones programadas</p>
                <p className="text-xs text-gray-300 mt-1">Las vacaciones aprobadas aparecerán aquí</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Banner si hay vacaciones activas hoy */}
                {activeToday && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl mb-3">
                    <Palmtree size={18} className="text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">¡Estás de vacaciones hoy!</p>
                      <p className="text-xs text-emerald-600">
                        {fmtDate(activeToday.startDate)} → {fmtDate(activeToday.endDate)}
                      </p>
                    </div>
                  </div>
                )}

                {upcomingVacations.map((req) => {
                  const isActive = req.startDate <= today && req.endDate >= today;
                  return (
                    <div
                      key={req.id}
                      className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border ${
                        isActive
                          ? "bg-emerald-50 border-emerald-100"
                          : "bg-blue-50 border-blue-100"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CalendarDays
                          size={15}
                          className={`shrink-0 ${isActive ? "text-emerald-600" : "text-blue-500"}`}
                        />
                        <div className="min-w-0">
                          <p className={`text-sm font-medium truncate ${isActive ? "text-emerald-800" : "text-blue-800"}`}>
                            {fmtDateShort(req.startDate)} → {fmtDateShort(req.endDate)}{" "}
                            <span className="font-normal text-xs">
                              ({req.requestedBusinessDays} días hábiles)
                            </span>
                          </p>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                          isActive
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {isActive ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                            En curso
                          </>
                        ) : (
                          <>
                            <Clock size={10} />
                            Próxima
                          </>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right column (1/3) ──────────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-6">
          {/* Balance de Vacaciones */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <CalendarDays size={16} className="text-seekop-500" />
              Balance de Vacaciones {new Date().getFullYear()}
            </h3>
            <p className="text-xs text-gray-400 mb-4">Resumen de tus días disponibles</p>

            {balanceQ.isLoading ? (
              <BalanceSkeleton />
            ) : balance ? (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-gray-500">Días usados</span>
                    <span className="font-semibold text-gray-800">
                      {balance.usedDays} / {balance.grantedDays + balance.carriedOverDays}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-seekop-400 to-seekop-600 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          (balance.usedDays / (balance.grantedDays + balance.carriedOverDays || 1)) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 bg-emerald-50 rounded-xl">
                    <p className="text-xl font-bold text-emerald-600">{balance.availableDays}</p>
                    <p className="text-xs text-emerald-600/70">Disponibles</p>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-xl">
                    <p className="text-xl font-bold text-blue-600">{balance.grantedDays}</p>
                    <p className="text-xs text-blue-600/70">Otorgados</p>
                  </div>
                  <div className="text-center p-3 bg-amber-50 rounded-xl">
                    <p className="text-xl font-bold text-amber-600">{balance.usedDays}</p>
                    <p className="text-xs text-amber-600/70">Usados</p>
                  </div>
                  <div className="text-center p-3 bg-violet-50 rounded-xl">
                    <p className="text-xl font-bold text-violet-600">{balance.carriedOverDays}</p>
                    <p className="text-xs text-violet-600/70">Arrastrados</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-300 text-center py-4">Sin datos de balance</p>
            )}
          </div>

          {/* Mi Manager */}
          {teamQ.isLoading ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gray-100 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-gray-100 rounded-full w-3/4" />
                  <div className="h-3 bg-gray-100 rounded-full w-1/2" />
                </div>
              </div>
            </div>
          ) : team?.manager ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Crown size={16} className="text-amber-500" />
                Mi Manager
              </h3>
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-xl bg-gradient-to-br ${avatarGradient(team.manager.id)} text-white text-sm font-bold flex items-center justify-center shrink-0`}
                >
                  {getInitials(team.manager.full_name)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{team.manager.full_name}</p>
                  <p className="text-xs text-gray-400 truncate">{team.manager.email}</p>
                  {team.manager.position && (
                    <p className="text-[11px] text-gray-400">{team.manager.position}</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {/* Mi Equipo (unificado) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Users size={16} className="text-seekop-500" />
              Mi Equipo
            </h3>
            <p className="text-xs text-gray-400 mb-4">{allTeamMembers.length} compañero(s)</p>

            {teamQ.isLoading ? (
              <TeamSkeleton />
            ) : allTeamMembers.length > 0 ? (
              <div className="space-y-1">
                {visibleTeamMembers.map((m) => {
                  const isOnVacation = onVacationNowIds.has(m.id);
                  const upcomingVac = upcomingVacationMap.get(m.id);
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div
                        className={`w-8 h-8 rounded-lg bg-gradient-to-br ${avatarGradient(m.id)} text-white text-[10px] font-bold flex items-center justify-center shrink-0`}
                      >
                        {getInitials(m.full_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-700 truncate">{m.full_name}</p>
                        <p className="text-[11px] text-gray-400 truncate">
                          {m.position ||
                            ROLE_LABELS[m.role as keyof typeof ROLE_LABELS] ||
                            m.role}
                        </p>
                      </div>
                      {isOnVacation ? (
                        <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                          🌴 Hoy
                        </span>
                      ) : upcomingVac ? (
                        <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">
                          <Clock size={9} />
                          {fmtDateShort(upcomingVac.start_date)}
                        </span>
                      ) : null}
                    </div>
                  );
                })}

                {allTeamMembers.length > 6 && (
                  <button
                    onClick={() => setShowAllTeam(!showAllTeam)}
                    className="w-full mt-2 flex items-center justify-center gap-1.5 text-xs text-seekop-600 hover:text-seekop-700 py-2 rounded-lg hover:bg-seekop-50 transition-colors"
                  >
                    {showAllTeam ? (
                      <>
                        <ChevronUp size={14} /> Mostrar menos
                      </>
                    ) : (
                      <>
                        <ChevronDown size={14} /> Ver todos ({allTeamMembers.length - 6} más)
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-300 text-center py-4">Sin compañeros registrados</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Password Modal (portal) ───────────────────────────────────────────── */}
      {mounted && showPasswordModal && (
        <PasswordModal onClose={() => setShowPasswordModal(false)} />
      )}
    </div>
  );
}
