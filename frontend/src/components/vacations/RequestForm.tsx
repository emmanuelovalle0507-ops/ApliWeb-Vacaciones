"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar, AlertCircle } from "lucide-react";
import { createRequestSchema, type CreateRequestFormData } from "@/types/schemas";
import { businessDaysBetween } from "@/lib/dates";
import { todayISO } from "@/lib/dates";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Button from "@/components/ui/Button";

interface RequestFormProps {
  availableDays: number;
  onSubmit: (data: CreateRequestFormData) => Promise<void>;
  onCancel: () => void;
}

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

  const handleFormSubmit = async (data: CreateRequestFormData) => {
    const days = businessDaysBetween(data.startDate, data.endDate);
    if (days <= 0) {
      setError("endDate", { message: "El rango no contiene días hábiles" });
      return;
    }
    if (days > availableDays) {
      setError("endDate", {
        message: `No tienes suficientes días disponibles (disponibles: ${availableDays}, solicitados: ${days})`,
      });
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

      {/* Business days preview */}
      {startDate && endDate && businessDays > 0 && (
        <div className="flex items-center gap-2 p-3 bg-seekop-50 border border-seekop-200 rounded-lg">
          <Calendar size={18} className="text-seekop-600" />
          <p className="text-sm text-seekop-800">
            Días hábiles solicitados: <strong>{businessDays}</strong>
            {" — "}
            Disponibles: <strong>{availableDays}</strong>
          </p>
        </div>
      )}

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
        <Button type="submit" loading={isSubmitting}>
          Enviar Solicitud
        </Button>
      </div>
    </form>
  );
}
