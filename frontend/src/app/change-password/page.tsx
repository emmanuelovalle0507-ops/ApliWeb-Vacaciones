"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import api from "@/api/client";
import { getSession, setSession, dashboardPathForRole } from "@/lib/auth";

export default function ChangePasswordPage() {
  const router = useRouter();
  const session = getSession();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!session) {
    if (typeof window !== "undefined") router.replace("/login");
    return null;
  }

  const rules = [
    { label: "Mínimo 4 caracteres", met: newPassword.length >= 4 },
    { label: "Las contraseñas coinciden", met: newPassword.length > 0 && newPassword === confirmPassword },
    { label: "Diferente a la actual", met: newPassword.length > 0 && newPassword !== currentPassword },
  ];
  const allMet = rules.every((r) => r.met) && currentPassword.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!allMet) {
      setError("Completa todos los requisitos antes de continuar.");
      return;
    }

    setLoading(true);
    try {
      await api.auth.changePassword(currentPassword, newPassword);
      setSuccess(true);
      // Update session so mustChangePassword is no longer flagged
      if (session) {
        setSession(session.token, session.user);
      }
      setTimeout(() => {
        router.push(dashboardPathForRole(session!.user.role));
      }, 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al cambiar la contraseña.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = (hasError?: boolean) =>
    `w-full px-4 py-3 pr-11 border rounded-xl text-sm outline-none transition-all duration-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-seekop-400/30 focus:border-seekop-500 ${
      hasError ? "border-red-300" : "border-gray-200"
    }`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        {success ? (
          /* ── Success state ── */
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
            <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 mb-5">
              <CheckCircle2 size={36} className="text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Contraseña actualizada</h2>
            <p className="text-sm text-gray-500">
              Tu contraseña ha sido cambiada exitosamente. Redirigiendo al panel...
            </p>
            <div className="mt-4">
              <div className="w-8 h-8 mx-auto border-2 border-seekop-500 border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        ) : (
          /* ── Form state ── */
          <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="px-8 pt-8 pb-5 bg-gradient-to-r from-seekop-50/60 to-white border-b border-gray-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-seekop-100 text-seekop-600">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Cambiar contraseña</h2>
                  <p className="text-xs text-gray-400">
                    Por seguridad, establece una nueva contraseña para tu cuenta
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <AlertCircle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed">
                  Estás usando una contraseña temporal asignada por RH. Debes cambiarla antes de continuar.
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5">
              {/* Current password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Contraseña actual (temporal)
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="La contraseña que te dio RH"
                    className={inputClass()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Tu nueva contraseña"
                    className={inputClass()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirmar nueva contraseña
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite tu nueva contraseña"
                  className={inputClass()}
                />
              </div>

              {/* Rules checklist */}
              <div className="space-y-2 p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Requisitos</p>
                {rules.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    {r.met ? (
                      <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                    ) : (
                      <div className="w-[15px] h-[15px] rounded-full border-2 border-gray-300 shrink-0" />
                    )}
                    <span className={r.met ? "text-emerald-700" : "text-gray-500"}>
                      {r.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={!allMet || loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-seekop-500 hover:bg-seekop-600 active:bg-seekop-700 text-white font-semibold rounded-xl text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-seekop-400/50 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-seekop-500/20"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Actualizando...
                  </>
                ) : (
                  <>
                    <Lock size={16} />
                    Establecer nueva contraseña
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          &copy; {new Date().getFullYear()} SEEKOP Consulting
        </p>
      </div>
    </div>
  );
}
