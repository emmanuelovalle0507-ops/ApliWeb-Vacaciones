"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  Copy,
  Check,
  Mail,
  Key,
  Globe,
  User as UserIcon,
  Info,
} from "lucide-react";
import Button from "@/components/ui/Button";

interface UserCreatedModalProps {
  open: boolean;
  onClose: () => void;
  employeeName: string;
  employeeEmail: string;
  tempPassword: string;
  emailSent: boolean;
}

function CopyField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
      <div className="min-w-0">
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <p className={`text-sm font-semibold text-gray-800 truncate ${mono ? "font-mono tracking-wider" : ""}`}>
          {value}
        </p>
      </div>
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:text-seekop-600 hover:bg-seekop-50 rounded-lg border border-gray-200 hover:border-seekop-200 transition-all duration-200 shrink-0"
        title="Copiar al portapapeles"
      >
        {copied ? (
          <>
            <Check size={13} className="text-emerald-500" />
            <span className="text-emerald-600">Copiado</span>
          </>
        ) : (
          <>
            <Copy size={13} />
            Copiar
          </>
        )}
      </button>
    </div>
  );
}

export default function UserCreatedModal({
  open,
  onClose,
  employeeName,
  employeeEmail,
  tempPassword,
  emailSent,
}: UserCreatedModalProps) {
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const firstName = employeeName.split(" ")[0] || "Colaborador";
  const loginUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-8 pt-8 pb-2 text-center">
          <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 mb-4">
            <CheckCircle2 size={36} className="text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Empleado registrado</h2>
          <p className="text-sm text-gray-400 mt-1">
            <span className="font-semibold text-gray-600">{employeeName}</span> fue dado de alta exitosamente
          </p>
        </div>

        {/* Credentials */}
        <div className="px-8 py-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Key size={14} className="text-seekop-500" />
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Credenciales de acceso</h4>
          </div>
          <CopyField label="URL del sistema" value={loginUrl} />
          <CopyField label="Email / Usuario" value={employeeEmail} />
          <CopyField label="Contraseña temporal" value={tempPassword} mono />

          <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-100 rounded-xl mt-2">
            <Info size={15} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-relaxed">
              Al iniciar sesión por primera vez, el sistema le pedirá al empleado <strong>cambiar su contraseña</strong>.
            </p>
          </div>
        </div>

        {/* Email status */}
        <div className="px-8 pb-2">
          <div className="flex items-center gap-3 p-3.5 rounded-xl border border-gray-100 bg-gray-50/50">
            <Mail size={18} className={emailSent ? "text-emerald-500" : "text-gray-400"} />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">
                {emailSent ? "Correo de bienvenida enviado" : "Correo de bienvenida (modo demo)"}
              </p>
              <p className="text-xs text-gray-400">
                {emailSent
                  ? `Se envió un email a ${employeeEmail} con las credenciales.`
                  : "SMTP no configurado. Las credenciales se muestran arriba para copiar manualmente."}
              </p>
            </div>
            {!emailSent && (
              <button
                onClick={() => setShowEmailPreview(!showEmailPreview)}
                className="text-xs text-seekop-500 hover:text-seekop-700 font-medium shrink-0"
              >
                {showEmailPreview ? "Ocultar" : "Ver preview"}
              </button>
            )}
          </div>

          {/* Email preview (demo) */}
          {showEmailPreview && (
            <div className="mt-3 border border-gray-200 rounded-xl overflow-hidden text-sm">
              <div className="bg-seekop-500 px-5 py-3">
                <p className="text-white font-bold text-sm">SEEKOP Vacaciones</p>
              </div>
              <div className="px-5 py-4 space-y-3 bg-white">
                <p className="font-bold text-gray-900 text-base">¡Bienvenido, {firstName}!</p>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Se ha creado tu cuenta en el sistema de control de vacaciones.
                  A continuación encontrarás tus credenciales de acceso:
                </p>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-1.5"><Globe size={13} /> URL</span>
                    <span className="font-semibold text-seekop-600">{loginUrl}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-1.5"><UserIcon size={13} /> Usuario</span>
                    <span className="font-semibold text-gray-800">{employeeEmail}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-1.5"><Key size={13} /> Contraseña</span>
                    <span className="font-bold text-seekop-600 font-mono tracking-wider">{tempPassword}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  Al iniciar sesión, el sistema te pedirá cambiar tu contraseña.
                </p>
              </div>
              <div className="bg-gray-50 border-t border-gray-200 px-5 py-2.5">
                <p className="text-xs text-gray-400 text-center">
                  Este correo fue enviado automáticamente por SEEKOP Vacaciones.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-8 py-5 border-t border-gray-100 mt-2">
          <Button variant="primary" onClick={onClose}>
            Entendido
          </Button>
        </div>
      </div>
    </div>
  );
}
