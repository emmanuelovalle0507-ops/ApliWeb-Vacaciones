"use client";

import React, { useEffect, useState, useRef } from "react";
import { Calendar, AlertCircle, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { businessDaysBetween, todayISO } from "@/lib/dates";
import api from "@/api/client";
import type { VacationRequest } from "@/types";
import Modal from "@/components/ui/Modal";
import DatePickerInput from "@/components/ui/DatePickerInput";
import Button from "@/components/ui/Button";

interface EditRequestModalProps {
  open: boolean;
  onClose: () => void;
  request: VacationRequest | null;
  onConfirm: (requestId: string, payload: { startDate: string; endDate: string; employeeComment?: string }) => Promise<void>;
  loading?: boolean;
}

type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  requestedDays: number;
  balanceByYear: Record<number, { requested: number; available: number }>;
};

export default function EditRequestModal({
  open,
  onClose,
  request,
  onConfirm,
  loading = false,
}: EditRequestModalProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [comment, setComment] = useState("");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Populate form when request changes
  useEffect(() => {
    if (request && open) {
      setStartDate(request.startDate);
      setEndDate(request.endDate);
      setComment(request.employeeComment ?? "");
      setValidation(null);
      setSubmitError(null);
    }
  }, [request, open]);

  const businessDays = startDate && endDate ? businessDaysBetween(startDate, endDate) : 0;

  // Pre-validate when dates change
  useEffect(() => {
    if (!startDate || !endDate || businessDays <= 0) {
      setValidation(null);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setValidating(true);
      try {
        const result = await api.requests.preValidate(startDate, endDate);
        setValidation(result);
      } catch {
        setValidation(null);
      } finally {
        setValidating(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [startDate, endDate, businessDays]);

  if (!request) return null;

  const today = todayISO();

  const hasChanges =
    startDate !== request.startDate ||
    endDate !== request.endDate ||
    (comment || "") !== (request.employeeComment || "");

  const canSubmit = hasChanges && !validating && (!validation || validation.valid) && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitError(null);
    try {
      await onConfirm(request.id, {
        startDate,
        endDate,
        employeeComment: comment || undefined,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Error al editar la solicitud");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Editar Solicitud de Vacaciones"
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            loading={loading}
            disabled={!canSubmit}
          >
            Guardar Cambios
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DatePickerInput
            label="Fecha de inicio"
            value={startDate}
            onChange={(v) => setStartDate(v)}
            minDate={today}
          />
          <DatePickerInput
            label="Fecha de fin"
            value={endDate}
            onChange={(v) => setEndDate(v)}
            minDate={startDate || today}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Comentario (opcional)
          </label>
          <textarea
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none transition-colors focus:ring-2 focus:ring-seekop-400 focus:border-seekop-500 resize-none"
            rows={3}
            placeholder="Motivo o detalle de la solicitud..."
            maxLength={500}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>

        {/* Validating spinner */}
        {validating && (
          <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <Loader2 size={18} className="text-gray-500 animate-spin" />
            <p className="text-sm text-gray-600">Validando disponibilidad...</p>
          </div>
        )}

        {/* Server-side validation errors */}
        {!validating && validation && !validation.valid && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-1">
            {validation.errors.map((err, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm text-red-800">{err}</p>
              </div>
            ))}
          </div>
        )}

        {/* Server-side validation warnings */}
        {!validating && validation && validation.valid && validation.warnings.length > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
            {validation.warnings.map((warn, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-800">{warn}</p>
              </div>
            ))}
          </div>
        )}

        {/* Business days preview — valid */}
        {!validating && validation && validation.valid && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <CheckCircle2 size={18} className="text-emerald-600" />
            <p className="text-sm text-emerald-800">
              Días hábiles solicitados: <strong>{validation.requestedDays}</strong>
              {Object.entries(validation.balanceByYear).map(([yr, bal]) => (
                <span key={yr}>
                  {" — "}{yr}: <strong>{bal.available}</strong> disponibles
                </span>
              ))}
            </p>
          </div>
        )}

        {/* No business days in range */}
        {startDate && endDate && businessDays === 0 && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle size={18} className="text-amber-600" />
            <p className="text-sm text-amber-800">
              El rango seleccionado no contiene días hábiles (se excluyen sábados, domingos y días festivos oficiales).
            </p>
          </div>
        )}

        {/* Submit error */}
        {submitError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
              <p className="text-sm text-red-800">{submitError}</p>
            </div>
          </div>
        )}

        {/* No changes hint */}
        {!hasChanges && (
          <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <Calendar size={18} className="text-gray-400" />
            <p className="text-sm text-gray-500">Modifica las fechas o el comentario para guardar cambios.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
