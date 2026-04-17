"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Trash2, X } from "lucide-react";

type Variant = "danger" | "warning";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_STYLES: Record<
  Variant,
  { icon: React.ReactNode; iconBg: string; iconColor: string; btnBg: string; btnHover: string; ring: string }
> = {
  danger: {
    icon: <Trash2 size={24} strokeWidth={1.8} />,
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
    btnBg: "bg-red-600",
    btnHover: "hover:bg-red-700 active:bg-red-800",
    ring: "focus-visible:ring-red-400",
  },
  warning: {
    icon: <AlertTriangle size={24} strokeWidth={1.8} />,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    btnBg: "bg-amber-600",
    btnHover: "hover:bg-amber-700 active:bg-amber-800",
    ring: "focus-visible:ring-amber-400",
  },
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Eliminar",
  cancelLabel = "Cancelar",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimating(true)));
      cancelRef.current?.focus();
    } else {
      setAnimating(false);
      const t = setTimeout(() => setVisible(false), 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!visible || !mounted) return null;

  const v = VARIANT_STYLES[variant];

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-200 ${
          animating ? "opacity-100" : "opacity-0"
        }`}
        onClick={onCancel}
      />

      {/* Dialog */}
      <div
        className={`relative w-full max-w-sm transform transition-all duration-200 ${
          animating
            ? "scale-100 opacity-100 translate-y-0"
            : "scale-95 opacity-0 translate-y-2"
        }`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={description ? "confirm-desc" : undefined}
      >
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden ring-1 ring-black/5">
          {/* Close button */}
          <button
            onClick={onCancel}
            className="absolute top-3 right-3 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors z-10"
          >
            <X size={16} />
          </button>

          {/* Content */}
          <div className="px-6 pt-6 pb-5">
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div
                className={`flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-xl ${v.iconBg} ${v.iconColor}`}
              >
                {v.icon}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0 pt-0.5">
                <h3
                  id="confirm-title"
                  className="text-base font-semibold text-gray-900 leading-snug"
                >
                  {title}
                </h3>
                {description && (
                  <p
                    id="confirm-desc"
                    className="mt-1.5 text-sm text-gray-500 leading-relaxed"
                  >
                    {description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 px-6 py-4 bg-gray-50/80 border-t border-gray-100">
            <button
              ref={cancelRef}
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 focus-visible:ring-offset-1"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 text-sm font-semibold text-white rounded-xl shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${v.btnBg} ${v.btnHover} ${v.ring}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
