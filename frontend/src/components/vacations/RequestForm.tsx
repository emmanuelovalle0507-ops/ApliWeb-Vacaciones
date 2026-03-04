"use client";

import React, { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar, AlertCircle, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { createRequestSchema, type CreateRequestFormData } from "@/types/schemas";
import { businessDaysBetween } from "@/lib/dates";
import { todayISO } from "@/lib/dates";
import api from "@/api/client";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Button from "@/components/ui/Button";

interface RequestFormProps {
  availableDays: number;
  onSubmit: (data: CreateRequestFormData) => Promise<void>;
  onCancel: () => void;
}

type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  requestedDays: number;
  balanceByYear: Record<number, { requested: number; available: number }>;
};

export default function RequestForm({ availableDays, onSubmit, onCancel }: RequestFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<CreateRequestFormData>({
    resolver: zodResolver(createRequestSchema),
  });

  const startDate = watch("startDate");
  const endDate = watch("endDate");

  const businessDays =
    startDate && endDate ? businessDaysBetween(startDate, endDate) : 0;

  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleFormSubmit = async (data: CreateRequestFormData) => {
    if (validation && !validation.valid) {
      setError("endDate", { message: validation.errors[0] || "Validación fallida" });
      return;
    }
    await onSubmit(data);
  };

  const today = todayISO();

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          type="date"
          label="Fecha de inicio"
          min={today}
          error={errors.startDate?.message}
          {...register("startDate")}
        />
        <Input
          type="date"
          label="Fecha de fin"
          min={startDate || today}
          error={errors.endDate?.message}
          {...register("endDate")}
        />
      </div>

      <Textarea
        label="Comentario (opcional)"
        placeholder="Motivo o detalle de la solicitud..."
        error={errors.employeeComment?.message}
        {...register("employeeComment")}
      />

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
            El rango seleccionado no contiene días hábiles (se excluyen sábados y domingos).
          </p>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="submit"
          loading={isSubmitting}
          disabled={validating || (validation !== null && !validation.valid)}
        >
          Enviar Solicitud
        </Button>
      </div>
    </form>
  );
}
