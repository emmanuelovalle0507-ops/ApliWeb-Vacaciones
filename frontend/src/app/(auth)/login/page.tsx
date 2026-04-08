"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, AlertCircle, Loader2, Shield, BarChart3, Users, CalendarCheck, Mail, ArrowLeft, KeyRound, UserX, CheckCircle2, Copy, Phone } from "lucide-react";
import { loginSchema, type LoginFormData } from "@/types/schemas";
import { useAuth } from "@/providers/AuthProvider";
import api from "@/api/client";

function SeekopLogo({ size = "lg" }: { size?: "sm" | "lg" }) {
  const isLg = size === "lg";
  return (
    <div className="flex items-center gap-3">
      <div className={`flex items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ${isLg ? "h-14 px-3 ring-white/10" : "h-11 px-2.5 ring-slate-200/80"}`}>
        <Image
          src="/branding/seekop-logo.png"
          alt="Seekop Consulting"
          width={isLg ? 128 : 106}
          height={isLg ? 36 : 30}
          className={`w-auto object-contain ${isLg ? "h-8" : "h-6"}`}
          priority
        />
      </div>
      <div>
        <h1 className={`font-extrabold tracking-[0.22em] uppercase ${isLg ? "text-2xl text-white" : "text-lg text-gray-900"}`}>
          Seekop
        </h1>
        <p className={`font-medium tracking-[0.18em] uppercase ${isLg ? "text-[11px] text-[#9ab236] -mt-0.5" : "text-[10px] text-seekop-500 -mt-0.5"}`}>
          Consulting
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const [serverError, setServerError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotResult, setForgotResult] = useState<{ message: string; email_sent: boolean; temp_password?: string | null } | null>(null);
  const [forgotError, setForgotError] = useState("");
  const [copiedPass, setCopiedPass] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  function getErrorInfo(msg: string) {
    if (msg.includes("no esta registrado") || msg.includes("not found")) {
      return { icon: Mail, title: "Correo no encontrado", color: "amber" as const };
    }
    if (msg.includes("desactivada")) {
      return { icon: UserX, title: "Cuenta desactivada", color: "red" as const };
    }
    if (msg.includes("incorrecta") || msg.includes("contraseña")) {
      return { icon: KeyRound, title: "Contraseña incorrecta", color: "red" as const };
    }
    return { icon: AlertCircle, title: "Error de autenticacion", color: "red" as const };
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    setForgotError("");
    setForgotResult(null);
    try {
      const result = await api.auth.forgotPassword(forgotEmail.trim());
      setForgotResult(result);
    } catch (err: unknown) {
      setForgotError(err instanceof Error ? err.message : "Error al procesar la solicitud.");
    } finally {
      setForgotLoading(false);
    }
  }

  function closeForgot() {
    setShowForgot(false);
    setForgotEmail("");
    setForgotResult(null);
    setForgotError("");
    setCopiedPass(false);
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError("");
    try {
      await login(data.email, data.password);
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Credenciales incorrectas. Verifica tu email y contraseña.");
    }
  };


  return (
    <div className="min-h-screen flex">
      {/* ── Left: Branding Panel ── */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] relative overflow-hidden bg-gradient-to-br from-slate-950 via-seekop-900 to-seekop-700 flex-col justify-between p-10">
        {/* Decorative shapes */}
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-seekop-500/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-seekop-400/8 blur-3xl" />
        <div className="absolute top-1/2 right-0 w-48 h-48 rounded-full bg-seekop-600/5 blur-2xl" />

        {/* Logo */}
        <div className="relative z-10">
          <SeekopLogo size="lg" />
        </div>

        {/* Main message */}
        <div className="relative z-10 space-y-7">
          <div className="space-y-4">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/70">
              Plataforma interna · Seekop Consulting
            </div>
            <h2 className="text-3xl xl:text-[2.15rem] font-bold text-white leading-tight">
              Control interno de vacaciones
              <span className="block text-[#9ab236] mt-1">claro, seguro y centralizado</span>
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed max-w-sm">
              Gestiona solicitudes, aprobaciones, balances y operación del equipo desde una sola plataforma con experiencia por rol.
            </p>
          </div>

          {/* Feature pills */}
          <div className="space-y-3 pt-1">
            {[
              { icon: CalendarCheck, text: "Solicitudes y aprobaciones en tiempo real" },
              { icon: BarChart3, text: "Balances, métricas y seguimiento operativo" },
              { icon: Users, text: "Gestión por equipos, managers y RRHH" },
              { icon: Shield, text: "Control de acceso y trazabilidad" },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3 text-slate-200 text-sm">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/8 border border-white/8 text-[#9ab236] shrink-0">
                  <f.icon size={17} />
                </div>
                <span className="leading-snug">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-xs text-slate-500">&copy; {new Date().getFullYear()} SEEKOP Consulting. Todos los derechos reservados.</p>
        </div>
      </div>

      {/* ── Right: Login Form ── */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6 py-12">
        <div className={`w-full max-w-[420px] transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
            <SeekopLogo size="sm" />
          </div>

          {/* Form card */}
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8 md:p-9">
            <div className="mb-8">
              <div className="inline-flex items-center rounded-full bg-seekop-50 text-seekop-700 border border-seekop-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] mb-4">
                Acceso seguro
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Iniciar sesión</h2>
              <p className="text-sm text-gray-500 mt-1.5">Ingresa tus credenciales corporativas para continuar en la plataforma.</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="tu@seekop.com"
                  className={`w-full px-4 py-3 border rounded-xl text-sm outline-none transition-all duration-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-seekop-400/30 focus:border-seekop-500 ${
                    errors.email ? "border-red-300 focus:ring-red-400/30 focus:border-red-500" : "border-gray-200"
                  }`}
                  {...register("email")}
                />
                {errors.email && (
                  <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Ingresa tu contraseña"
                    className={`w-full px-4 py-3 pr-11 border rounded-xl text-sm outline-none transition-all duration-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-seekop-400/30 focus:border-seekop-500 ${
                      errors.password ? "border-red-300 focus:ring-red-400/30 focus:border-red-500" : "border-gray-200"
                    }`}
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.password.message}
                  </p>
                )}
              </div>

              {/* Error */}
              {serverError && (() => {
                const info = getErrorInfo(serverError);
                const ErrorIcon = info.icon;
                const isAmber = info.color === "amber";
                return (
                  <div className={`flex items-start gap-3 p-4 rounded-2xl border ${
                    isAmber ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"
                  }`}>
                    <div className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 ${
                      isAmber ? "bg-amber-100" : "bg-red-100"
                    }`}>
                      <ErrorIcon size={18} className={isAmber ? "text-amber-600" : "text-red-500"} />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${isAmber ? "text-amber-800" : "text-red-700"}`}>{info.title}</p>
                      <p className={`text-xs mt-0.5 ${isAmber ? "text-amber-600" : "text-red-600"}`}>{serverError}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-seekop-500 hover:bg-seekop-600 active:bg-seekop-700 text-white font-semibold rounded-2xl text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-seekop-400/50 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm shadow-seekop-500/20"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Verificando...
                  </>
                ) : (
                  "Iniciar Sesión"
                )}
              </button>

              {/* Forgot password link */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setShowForgot(true); setServerError(""); }}
                  className="text-sm text-seekop-600 hover:text-seekop-700 hover:underline transition-colors font-medium"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

            </form>
          </div>

          {/* Forgot Password Modal */}
          {showForgot && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
              <div className={`bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transition-all duration-300 ${mounted ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}>
                {!forgotResult ? (
                  <>
                    <div className="px-8 pt-8 pb-2">
                      <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-2xl bg-seekop-50 border border-seekop-100 mb-5">
                        <KeyRound size={28} className="text-seekop-600" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 text-center">Recuperar contraseña</h3>
                      <p className="text-sm text-gray-500 text-center mt-2 leading-relaxed">
                        Ingresa tu correo corporativo y te enviaremos una contraseña temporal para que puedas acceder.
                      </p>
                    </div>
                    <form onSubmit={handleForgotPassword} className="px-8 pb-8 pt-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Correo electronico</label>
                        <div className="relative">
                          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                            <Mail size={16} />
                          </div>
                          <input
                            type="email"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            placeholder="tu@seekop.com"
                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none bg-gray-50 focus:bg-white focus:ring-2 focus:ring-seekop-400/30 focus:border-seekop-500 transition-all"
                            autoFocus
                            required
                          />
                        </div>
                      </div>

                      {forgotError && (
                        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                          <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-red-700">{forgotError}</p>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={forgotLoading || !forgotEmail.trim()}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-seekop-500 hover:bg-seekop-600 text-white font-semibold rounded-xl text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {forgotLoading ? (
                          <><Loader2 size={16} className="animate-spin" /> Enviando...</>
                        ) : (
                          <><Mail size={16} /> Enviar contraseña temporal</>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={closeForgot}
                        className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 py-2 transition-colors"
                      >
                        <ArrowLeft size={14} /> Volver al inicio de sesion
                      </button>

                      <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 mt-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <Phone size={12} /> Tambien puedes contactar a RH
                        </p>
                        <p className="text-xs text-gray-400 leading-relaxed">
                          Si no tienes acceso a tu correo, contacta al equipo de Recursos Humanos para que restablezcan tu contraseña manualmente.
                        </p>
                      </div>
                    </form>
                  </>
                ) : (
                  <div className="px-8 py-8">
                    <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 mb-5">
                      <CheckCircle2 size={28} className="text-emerald-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 text-center">Solicitud procesada</h3>
                    <p className="text-sm text-gray-500 text-center mt-2 leading-relaxed">
                      {forgotResult.message}
                    </p>

                    {forgotResult.temp_password && (
                      <div className="mt-5 bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">
                          Contraseña temporal generada
                        </p>
                        <p className="text-[10px] text-amber-600 mb-3">
                          El servicio de correo no esta disponible. Copia esta contraseña temporal:
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 bg-white px-3 py-2.5 rounded-lg text-sm font-mono font-bold text-gray-900 border border-amber-200 text-center tracking-wider">
                            {forgotResult.temp_password}
                          </code>
                          <button
                            type="button"
                            onClick={() => { navigator.clipboard.writeText(forgotResult.temp_password!); setCopiedPass(true); setTimeout(() => setCopiedPass(false), 2000); }}
                            className={`px-3 py-2.5 rounded-lg text-xs font-medium border transition-all ${
                              copiedPass
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                : "bg-white border-amber-200 text-amber-700 hover:bg-amber-100"
                            }`}
                          >
                            {copiedPass ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                        <p className="text-[10px] text-amber-500 mt-2">Al iniciar sesion se te pedira cambiarla.</p>
                      </div>
                    )}

                    {forgotResult.email_sent && (
                      <div className="mt-5 bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                        <p className="text-sm text-emerald-700 text-center">
                          Revisa tu bandeja de entrada (y spam) para encontrar el correo con tu nueva contraseña temporal.
                        </p>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={closeForgot}
                      className="w-full mt-5 flex items-center justify-center gap-2 px-4 py-3 bg-seekop-500 hover:bg-seekop-600 text-white font-semibold rounded-xl text-sm transition-all"
                    >
                      <ArrowLeft size={14} /> Volver al inicio de sesion
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer on mobile */}
          <div className="text-center text-xs text-gray-400 mt-6 lg:hidden space-y-1">
            <p>&copy; {new Date().getFullYear()} SEEKOP Consulting</p>
            <p className="text-[11px] text-gray-300">Sistema interno de control de vacaciones</p>
          </div>
        </div>
      </div>
    </div>
  );
}
