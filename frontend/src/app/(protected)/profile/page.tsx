"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import api from "@/api/client";
import Button from "@/components/ui/Button";
import { ROLE_LABELS } from "@/types";
import type { TeamInfo } from "@/types";
import { useToast } from "@/components/ui/Toast";

const AVATAR_COLORS = [
  "from-blue-500 to-blue-600",
  "from-emerald-500 to-emerald-600",
  "from-violet-500 to-violet-600",
  "from-amber-500 to-amber-600",
  "from-rose-500 to-rose-600",
  "from-cyan-500 to-cyan-600",
];

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function avatarGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | undefined | null }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gray-50 text-gray-400 shrink-0">
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <p className="text-sm font-medium text-gray-800 truncate">{value || <span className="text-gray-300">Sin asignar</span>}</p>
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

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Password state ──
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changePwLoading, setChangePwLoading] = useState(false);
  const [changePwError, setChangePwError] = useState("");

  // ── Editable profile state ──
  const [editingProfile, setEditingProfile] = useState(false);
  const [phone, setPhone] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

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

  useEffect(() => {
    if (profileQ.data) {
      setPhone(profileQ.data.phone || "");
      setEmergencyContact(profileQ.data.emergency_contact || "");
    }
  }, [profileQ.data]);

  if (!user) return null;

  const rules = [
    { label: "Mínimo 4 caracteres", met: newPassword.length >= 4 },
    { label: "Las contraseñas coinciden", met: newPassword.length > 0 && newPassword === confirmPassword },
    { label: "Diferente a la actual", met: newPassword.length > 0 && newPassword !== currentPassword },
  ];
  const allMet = rules.every((r) => r.met) && currentPassword.length > 0;

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!allMet) return;
    setChangePwError("");
    setChangePwLoading(true);
    try {
      await api.auth.changePassword(currentPassword, newPassword);
      toast("success", "Contraseña actualizada correctamente");
      setShowChangePassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setChangePwError(err instanceof Error ? err.message : "Error al cambiar contraseña");
    } finally {
      setChangePwLoading(false);
    }
  }

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

  const hireDateFormatted = user.hireDate
    ? new Date(user.hireDate + "T12:00:00").toLocaleDateString("es-MX", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const balance = balanceQ.data;
  const team: TeamInfo | undefined = teamQ.data;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-seekop-500 via-seekop-600 to-seekop-700 relative">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIi8+PC9zdmc+')] opacity-60" />
        </div>
        <div className="px-8 pb-6 -mt-14 relative">
          <div className="flex flex-col sm:flex-row sm:items-end gap-5">
            <div className={`flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br ${avatarGradient(user.id)} text-white text-3xl font-bold shadow-lg border-4 border-white shrink-0`}>
              {getInitials(user.fullName)}
            </div>
            <div className="flex-1 pt-2">
              <h1 className="text-2xl font-bold text-gray-900">{user.fullName}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
                  <Mail size={14} /> {user.email}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold bg-seekop-50 text-seekop-700 rounded-full border border-seekop-200">
                  <Shield size={12} /> {ROLE_LABELS[user.role]}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Info Personal + Contacto Editable */}
        <div className="space-y-6">
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

          {/* Editable Contact Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Phone size={16} className="text-seekop-500" />
                Datos de Contacto
              </h3>
              {!editingProfile ? (
                <button onClick={() => setEditingProfile(true)} className="text-xs text-seekop-600 hover:text-seekop-700 flex items-center gap-1">
                  <Pencil size={12} /> Editar
                </button>
              ) : (
                <button onClick={() => { setEditingProfile(false); setPhone(profileQ.data?.phone || ""); setEmergencyContact(profileQ.data?.emergency_contact || ""); }} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <X size={12} /> Cancelar
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 mb-4">Tu teléfono y contacto de emergencia</p>

            {editingProfile ? (
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
                  <label className="block text-xs font-medium text-gray-600 mb-1">Contacto de emergencia</label>
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
          </div>
        </div>

        {/* Column 2: Balance + Team Info */}
        <div className="space-y-6">
          {/* Balance card */}
          {balance && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <CalendarDays size={16} className="text-seekop-500" />
                Balance de Vacaciones {new Date().getFullYear()}
              </h3>
              <p className="text-xs text-gray-400 mb-4">Resumen de tus días disponibles</p>
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
                        width: `${Math.min(100, (balance.usedDays / (balance.grantedDays + balance.carriedOverDays)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
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
                </div>
              </div>
            </div>
          )}

          {/* Manager card */}
          {team?.manager && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Crown size={16} className="text-amber-500" />
                Mi Manager
              </h3>
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${avatarGradient(team.manager.id)} text-white text-sm font-bold flex items-center justify-center shrink-0`}>
                  {getInitials(team.manager.full_name)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{team.manager.full_name}</p>
                  <p className="text-xs text-gray-400 truncate">{team.manager.email}</p>
                  {team.manager.position && <p className="text-[11px] text-gray-400">{team.manager.position}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Security */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Lock size={16} className="text-seekop-500" />
              Seguridad
            </h3>
            <p className="text-xs text-gray-400 mb-4">Gestiona tu contraseña de acceso</p>
            <Button
              variant={showChangePassword ? "secondary" : "primary"}
              className="w-full"
              onClick={() => { setShowChangePassword(!showChangePassword); setChangePwError(""); }}
            >
              <Lock size={15} className="mr-2" />
              {showChangePassword ? "Cancelar" : "Cambiar contraseña"}
            </Button>
          </div>
        </div>

        {/* Column 3: Team Members + Vacations */}
        <div className="space-y-6">
          {/* Team members */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Users size={16} className="text-seekop-500" />
              Mi Equipo
            </h3>
            <p className="text-xs text-gray-400 mb-4">{team?.team_members.length ?? 0} compañero(s)</p>

            {team && team.team_members.length > 0 ? (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {team.team_members.map((m) => (
                  <div key={m.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${avatarGradient(m.id)} text-white text-[10px] font-bold flex items-center justify-center shrink-0`}>
                      {getInitials(m.full_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-700 truncate">{m.full_name}</p>
                      <p className="text-[11px] text-gray-400 truncate">{m.position || ROLE_LABELS[m.role as keyof typeof ROLE_LABELS] || m.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-300 text-center py-4">Sin compañeros registrados</p>
            )}
          </div>

          {/* On vacation now */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Palmtree size={16} className="text-green-500" />
              De Vacaciones Ahora
            </h3>
            <p className="text-xs text-gray-400 mb-3">Compañeros fuera hoy</p>

            {team && team.on_vacation_now.length > 0 ? (
              <div className="space-y-2">
                {team.on_vacation_now.map((v) => (
                  <div key={v.id} className="flex items-center gap-2.5 p-2 bg-green-50 rounded-lg border border-green-100">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${avatarGradient(v.id)} text-white text-[10px] font-bold flex items-center justify-center shrink-0`}>
                      {getInitials(v.full_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-700 truncate">{v.full_name}</p>
                      <p className="text-[11px] text-green-600">{fmtDate(v.start_date)} → {fmtDate(v.end_date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-3">
                <p className="text-xs text-gray-300">Todos están trabajando hoy</p>
              </div>
            )}
          </div>

          {/* Upcoming vacations */}
          {team && team.upcoming_vacations.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <Clock size={16} className="text-blue-500" />
                Próximas Ausencias
              </h3>
              <p className="text-xs text-gray-400 mb-3">En los próximos 30 días</p>
              <div className="space-y-2">
                {team.upcoming_vacations.map((v) => (
                  <div key={v.id} className="flex items-center gap-2.5 p-2 bg-blue-50 rounded-lg border border-blue-100">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${avatarGradient(v.id)} text-white text-[10px] font-bold flex items-center justify-center shrink-0`}>
                      {getInitials(v.full_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-700 truncate">{v.full_name}</p>
                      <p className="text-[11px] text-blue-600">{fmtDate(v.start_date)} → {fmtDate(v.end_date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Change Password Form */}
      {showChangePassword && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Lock size={16} className="text-seekop-500" />
            Cambiar contraseña
          </h3>
          <form onSubmit={handleChangePassword} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-4">
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
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" tabIndex={-1}>
                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
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
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" tabIndex={-1}>
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
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
            </div>

            <div className="flex flex-col justify-between">
              <div className="space-y-2.5 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Requisitos</p>
                {rules.map((r, i) => (
                  <PasswordRule key={i} label={r.label} met={r.met} />
                ))}
              </div>

              {changePwError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl mt-3">
                  <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{changePwError}</p>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-4"
                disabled={!allMet}
                loading={changePwLoading}
              >
                Actualizar contraseña
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
