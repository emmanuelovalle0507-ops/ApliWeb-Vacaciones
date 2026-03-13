"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  X,
  UserPlus,
  Pencil,
  Mail,
  User as UserIcon,
  Shield,
  Users,
  Briefcase,
  CalendarDays,
  Lock,
  RefreshCw,
  Check,
  AlertCircle,
} from "lucide-react";
import Button from "@/components/ui/Button";
import type { User, UserCreatePayload, UserUpdatePayload } from "@/types";

interface UserFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitCreate?: (payload: UserCreatePayload) => Promise<void>;
  onSubmitUpdate?: (userId: string, payload: UserUpdatePayload) => Promise<void>;
  editUser?: User | null;
  teams: { id: string; name: string }[];
  managers: User[];
  allowedRoles?: string[];
  loading?: boolean;
}

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  EMPLOYEE: { label: "Empleado", color: "text-seekop-700", bg: "bg-seekop-50", border: "border-seekop-200" },
  MANAGER: { label: "Manager", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
  HR: { label: "Recursos Humanos", color: "text-teal-700", bg: "bg-teal-50", border: "border-teal-200" },
  ADMIN: { label: "Administrador", color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200" },
};

function generatePassword(length = 10): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-pink-500",
];

function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/* ── Section wrapper ── */
function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-seekop-50 text-seekop-600">
          <Icon size={15} />
        </div>
        <h4 className="text-sm font-semibold text-gray-700 tracking-wide uppercase">{title}</h4>
      </div>
      {children}
    </div>
  );
}

/* ── Styled field wrapper ── */
function Field({
  label,
  error,
  children,
  hint,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-600 mb-1.5">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
      {error && (
        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
}

const inputClass = (hasError?: boolean) =>
  `w-full px-3.5 py-2.5 border rounded-xl text-sm outline-none transition-all duration-200 bg-white placeholder:text-gray-300 focus:ring-2 focus:ring-seekop-400/40 focus:border-seekop-500 ${
    hasError ? "border-red-300 focus:ring-red-400/40 focus:border-red-500" : "border-gray-200 hover:border-gray-300"
  }`;

const selectClass =
  "w-full px-3.5 py-2.5 border border-gray-200 hover:border-gray-300 rounded-xl text-sm outline-none transition-all duration-200 bg-white focus:ring-2 focus:ring-seekop-400/40 focus:border-seekop-500 appearance-none cursor-pointer";

export default function UserFormModal({
  open,
  onClose,
  onSubmitCreate,
  onSubmitUpdate,
  editUser,
  teams,
  managers,
  allowedRoles = ["EMPLOYEE", "MANAGER"],
  loading = false,
}: UserFormModalProps) {
  const isEdit = !!editUser;

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("EMPLOYEE");
  const [teamId, setTeamId] = useState("");
  const [managerIds, setManagerIds] = useState<string[]>([]);
  const [hireDate, setHireDate] = useState("");
  const [position, setPosition] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = useCallback(() => {
    if (editUser) {
      setEmail(editUser.email);
      setFullName(editUser.fullName);
      setRole(editUser.role);
      setTeamId(editUser.area?.id === "no-team" ? "" : editUser.area?.id ?? "");
      setManagerIds(editUser.managerIds ?? []);
      setHireDate(editUser.hireDate ?? "");
      setPosition(editUser.position ?? "");
      setPassword("");
    } else {
      setEmail("");
      setFullName("");
      setRole("EMPLOYEE");
      setTeamId("");
      setManagerIds([]);
      setHireDate("");
      setPosition("");
      setPassword(generatePassword());
    }
    setShowPassword(false);
    setErrors({});
  }, [editUser]);

  useEffect(() => {
    if (open) resetForm();
  }, [open, resetForm]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = "El nombre completo es obligatorio.";
    if (!isEdit) {
      if (!email.trim()) errs.email = "El email corporativo es obligatorio.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Formato de email inválido.";
      if (!password || password.length < 4) errs.password = "La contraseña debe tener mínimo 4 caracteres.";
    }
    if (!role) errs.role = "Debes seleccionar un rol.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    try {
      if (isEdit && onSubmitUpdate && editUser) {
        await onSubmitUpdate(editUser.id, {
          fullName,
          role,
          teamId: teamId || undefined,
          managerIds,
          hireDate: hireDate || undefined,
          position: position || undefined,
        });
      } else if (onSubmitCreate) {
        await onSubmitCreate({
          email,
          fullName,
          role,
          teamId: teamId || undefined,
          managerIds,
          hireDate: hireDate || undefined,
          position: position || undefined,
          password,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setErrors({ _form: msg });
    }
  }

  function toggleManager(id: string) {
    setManagerIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : prev.length < 2 ? [...prev, id] : prev
    );
  }

  const overlayRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    if (open) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [open, onClose, loading]);

  if (!open) return null;

  const roleOptions = Object.entries(ROLE_CONFIG).filter(([key]) => allowedRoles.includes(key));

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current && !loading) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* ── Header ── */}
        <div className="relative px-8 pt-6 pb-5 border-b border-gray-100 bg-gradient-to-r from-seekop-50/60 to-white">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-seekop-100 text-seekop-600 shadow-sm">
                {isEdit ? <Pencil size={20} /> : <UserPlus size={20} />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {isEdit ? "Editar empleado" : "Registrar nuevo empleado"}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {isEdit
                    ? `Modificando datos de ${editUser?.fullName}`
                    : "Completa la información para dar de alta al colaborador"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          {errors._form && (
            <div className="flex items-center gap-3 p-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl">
              <AlertCircle size={18} className="text-red-400 shrink-0" />
              <span>{errors._form}</span>
            </div>
          )}

          {/* ── Información personal ── */}
          <Section icon={UserIcon} title="Información personal">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nombre completo" error={errors.fullName}>
                <input
                  type="text"
                  placeholder="Ej. Juan Pérez López"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputClass(!!errors.fullName)}
                />
              </Field>
              {!isEdit ? (
                <Field label="Email corporativo" error={errors.email} hint="Se usará como usuario de acceso">
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
                    <input
                      type="email"
                      placeholder="nombre@seekop.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`${inputClass(!!errors.email)} pl-10`}
                    />
                  </div>
                </Field>
              ) : (
                <Field label="Email corporativo">
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
                    <input
                      type="email"
                      value={email}
                      disabled
                      className="w-full pl-10 px-3.5 py-2.5 border border-gray-100 rounded-xl text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
                    />
                  </div>
                </Field>
              )}
            </div>
          </Section>

          <div className="border-t border-gray-100" />

          {/* ── Rol y equipo ── */}
          <Section icon={Shield} title="Rol y equipo">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Rol en la organización" error={errors.role}>
                <div className="grid grid-cols-2 gap-2">
                  {roleOptions.map(([key, cfg]) => {
                    const selected = role === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setRole(key)}
                        className={`relative flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 ${
                          selected
                            ? `${cfg.bg} ${cfg.color} ${cfg.border} ring-2 ring-offset-1 ring-seekop-400/30`
                            : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {selected && (
                          <Check size={14} className="shrink-0" />
                        )}
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Equipo / Área">
                <select
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Sin equipo asignado</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Section>

          <div className="border-t border-gray-100" />

          {/* ── Puesto y fecha ── */}
          <Section icon={Briefcase} title="Datos laborales">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Puesto / Cargo" hint="Ej. Desarrollador Senior, Analista de Datos">
                <input
                  type="text"
                  placeholder="Título del puesto"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className={inputClass()}
                />
              </Field>
              <Field label="Fecha de ingreso" hint="Se usa para calcular días de vacaciones">
                <div className="relative">
                  <CalendarDays size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                  <input
                    type="date"
                    value={hireDate}
                    onChange={(e) => setHireDate(e.target.value)}
                    className={`${inputClass()} pl-10`}
                  />
                </div>
              </Field>
            </div>
          </Section>

          <div className="border-t border-gray-100" />

          {/* ── Managers ── */}
          <Section icon={Users} title="Manager(s) asignados">
            <p className="text-xs text-gray-400 mb-3">
              Selecciona hasta <span className="font-semibold text-gray-500">2 managers</span> que
              podrán aprobar las solicitudes de vacaciones de este empleado.
            </p>
            {managers.length === 0 ? (
              <div className="flex items-center justify-center py-8 border border-dashed border-gray-200 rounded-xl">
                <p className="text-sm text-gray-400">No hay managers disponibles en el sistema.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {managers.map((m) => {
                  const selected = managerIds.includes(m.id);
                  const disabled = !selected && managerIds.length >= 2;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleManager(m.id)}
                      className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition-all duration-200 ${
                        selected
                          ? "border-seekop-300 bg-seekop-50/60 ring-2 ring-offset-1 ring-seekop-400/30"
                          : disabled
                          ? "border-gray-100 bg-gray-50/50 opacity-40 cursor-not-allowed"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer"
                      }`}
                    >
                      <div
                        className={`flex items-center justify-center w-9 h-9 rounded-full text-white text-xs font-bold shrink-0 ${avatarColor(m.id)}`}
                      >
                        {getInitials(m.fullName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{m.fullName}</p>
                        <p className="text-xs text-gray-400 truncate">{m.email}</p>
                      </div>
                      {selected && (
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-seekop-500 text-white shrink-0">
                          <Check size={14} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </Section>

          {/* ── Contraseña (solo creación) ── */}
          {!isEdit && (
            <>
              <div className="border-t border-gray-100" />
              <Section icon={Lock} title="Acceso al sistema">
                <Field label="Contraseña temporal" error={errors.password} hint="Se enviará al empleado por correo">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Contraseña segura"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`${inputClass(!!errors.password)} pr-20 font-mono`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-seekop-500 hover:text-seekop-700 font-medium transition-colors"
                      >
                        {showPassword ? "Ocultar" : "Mostrar"}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPassword(generatePassword())}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 border border-gray-200 hover:border-gray-300 rounded-xl text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all duration-200 shrink-0"
                      title="Generar contraseña aleatoria"
                    >
                      <RefreshCw size={14} />
                      Generar
                    </button>
                  </div>
                </Field>
              </Section>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between gap-3 px-8 py-4 border-t border-gray-100 bg-gray-50/50">
          <p className="text-xs text-gray-400 hidden sm:block">
            {isEdit ? "Los cambios se aplicarán de inmediato." : "El empleado podrá iniciar sesión con estas credenciales."}
          </p>
          <div className="flex gap-3 ml-auto">
            <Button variant="secondary" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSubmit} loading={loading}>
              {isEdit ? "Guardar cambios" : "Registrar empleado"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
