"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, AlertCircle, Loader2, Shield, BarChart3, Users, CalendarCheck } from "lucide-react";
import { loginSchema, type LoginFormData } from "@/types/schemas";
import { useAuth } from "@/providers/AuthProvider";

const isDemoBypassEnabled = (process.env.NEXT_PUBLIC_DEMO_BYPASS || "false") === "true";

function SeekopLogo({ size = "lg" }: { size?: "sm" | "lg" }) {
  const isLg = size === "lg";
  return (
    <div className="flex items-center gap-3">
      <div className={`flex items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 ${isLg ? "w-12 h-12" : "w-10 h-10"}`}>
        <span className={`font-black text-white ${isLg ? "text-xl" : "text-lg"}`}>S</span>
      </div>
      <div>
        <h1 className={`font-extrabold tracking-widest ${isLg ? "text-3xl text-white" : "text-xl text-gray-900"}`}>
          SEEKOP
        </h1>
        <p className={`font-semibold tracking-[0.25em] uppercase ${isLg ? "text-xs text-seekop-300 -mt-0.5" : "text-[10px] text-seekop-500 -mt-0.5"}`}>
          Consulting
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { login, loginDemo } = useAuth();
  const [serverError, setServerError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

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

  const handleDemoLogin = async (role: "EMPLOYEE" | "MANAGER" | "ADMIN" | "HR") => {
    setServerError("");
    setDemoLoading(role);
    try {
      await loginDemo(role);
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Error al iniciar sesión demo");
    } finally {
      setDemoLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left: Branding Panel ── */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-seekop-950 flex-col justify-between p-10">
        {/* Decorative shapes */}
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-seekop-500/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-seekop-400/8 blur-3xl" />
        <div className="absolute top-1/2 right-0 w-48 h-48 rounded-full bg-seekop-600/5 blur-2xl" />

        {/* Logo */}
        <div className="relative z-10">
          <SeekopLogo size="lg" />
        </div>

        {/* Main message */}
        <div className="relative z-10 space-y-6">
          <h2 className="text-2xl xl:text-3xl font-bold text-white leading-tight">
            Control de Vacaciones<br />
            <span className="text-seekop-400">Empresarial</span>
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
            Gestiona solicitudes, aprobaciones y balances de vacaciones de tu equipo de forma inteligente y centralizada.
          </p>

          {/* Feature pills */}
          <div className="space-y-3 pt-2">
            {[
              { icon: CalendarCheck, text: "Solicitudes y aprobaciones en tiempo real" },
              { icon: BarChart3, text: "Dashboard con métricas y balances" },
              { icon: Users, text: "Gestión por equipos y roles" },
              { icon: Shield, text: "Control de acceso seguro" },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3 text-slate-300 text-sm">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-seekop-500/15 text-seekop-400 shrink-0">
                  <f.icon size={16} />
                </div>
                {f.text}
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
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-seekop-500">
              <span className="font-black text-white text-lg">S</span>
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-gray-900 tracking-widest">SEEKOP</h1>
              <p className="text-[10px] font-semibold text-seekop-500 tracking-[0.25em] uppercase -mt-0.5">Consulting</p>
            </div>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Iniciar Sesión</h2>
              <p className="text-sm text-gray-500 mt-1">Ingresa tus credenciales para continuar</p>
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
              {serverError && (
                <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl animate-[fadeIn_0.3s_ease]">
                  <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{serverError}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-seekop-500 hover:bg-seekop-600 active:bg-seekop-700 text-white font-semibold rounded-xl text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-seekop-400/50 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm shadow-seekop-500/20"
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

              {/* Demo buttons */}
              {isDemoBypassEnabled && (
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 text-center">Acceso rápido</p>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { role: "EMPLOYEE" as const, label: "Empleado", color: "bg-seekop-50 text-seekop-700 hover:bg-seekop-100 border-seekop-200" },
                      { role: "MANAGER" as const, label: "Manager", color: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200" },
                      { role: "ADMIN" as const, label: "Admin", color: "bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200" },
                      { role: "HR" as const, label: "RRHH", color: "bg-teal-50 text-teal-700 hover:bg-teal-100 border-teal-200" },
                    ]).map((d) => (
                      <button
                        key={d.role}
                        type="button"
                        disabled={!!demoLoading}
                        onClick={() => void handleDemoLogin(d.role)}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-all duration-200 disabled:opacity-50 ${d.color}`}
                      >
                        {demoLoading === d.role ? <Loader2 size={14} className="animate-spin" /> : null}
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Footer on mobile */}
          <p className="text-center text-xs text-gray-400 mt-6 lg:hidden">
            &copy; {new Date().getFullYear()} SEEKOP Consulting
          </p>
        </div>
      </div>
    </div>
  );
}
