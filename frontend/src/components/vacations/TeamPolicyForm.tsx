"use client";

import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, Save, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import api from "@/api/client";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

export default function TeamPolicyForm() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [maxOff, setMaxOff] = useState("");
  const [minNotice, setMinNotice] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [dirty, setDirty] = useState(false);

  const policyQ = useQuery({
    queryKey: ["teamPolicies.me"],
    queryFn: () => api.teamPolicies.getMy(),
    retry: false,
    enabled: !!user,
  });

  const activePolicy = policyQ.data;

  useEffect(() => {
    if (activePolicy && !dirty) {
      setMaxOff(String(activePolicy.maxPeopleOffPerDay));
      setMinNotice(String(activePolicy.minNoticeDays));
      setEffectiveFrom(activePolicy.effectiveFrom?.split("T")[0] ?? "");
      setEffectiveTo(activePolicy.effectiveTo?.split("T")[0] ?? "");
    }
  }, [activePolicy, dirty]);

  const upsertMut = useMutation({
    mutationFn: () => {
      if (!user) throw new Error("No autenticado");
      return api.teamPolicies.upsert({
        teamId: user.area.id,
        maxPeopleOffPerDay: parseInt(maxOff, 10),
        minNoticeDays: parseInt(minNotice, 10),
        effectiveFrom: effectiveFrom || new Date().toISOString().split("T")[0],
        effectiveTo: effectiveTo || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teamPolicies.me"] });
      qc.invalidateQueries({ queryKey: ["teamPolicies.onboarding"] });
      setDirty(false);
      toast("success", "Política actualizada correctamente");
    },
    onError: (err) => {
      toast("error", err instanceof Error ? err.message : "Error al guardar política");
    },
  });

  const handleChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    setDirty(true);
  };

  const isValid = parseInt(maxOff, 10) > 0 && parseInt(minNotice, 10) >= 0 && effectiveFrom;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    upsertMut.mutate();
  };

  return (
    <Card>
      <CardHeader className="flex items-center gap-2">
        <Shield size={18} className="text-seekop-500" />
        <h3 className="text-sm font-semibold text-gray-900">Política de Vacaciones del Equipo</h3>
      </CardHeader>
      <CardBody>
        {policyQ.isLoading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        ) : (
          <>
            {activePolicy ? (
              <div className="mb-4 p-3 rounded-lg border border-emerald-200 bg-emerald-50 flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                <p className="text-sm text-emerald-800">
                  Política activa: máximo <strong>{activePolicy.maxPeopleOffPerDay}</strong> personas fuera por día,
                  mínimo <strong>{activePolicy.minNoticeDays}</strong> días de anticipación.
                  Vigente desde <strong>{activePolicy.effectiveFrom}</strong>.
                </p>
              </div>
            ) : (
              <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-800">
                  No hay política activa para tu equipo. Configura una para que las solicitudes se validen correctamente.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Máx. personas fuera por día"
                  type="number"
                  min="1"
                  value={maxOff}
                  onChange={handleChange(setMaxOff)}
                  placeholder="Ej: 3"
                  error={maxOff && parseInt(maxOff, 10) <= 0 ? "Debe ser mayor a 0" : undefined}
                />
                <Input
                  label="Días mínimos de anticipación"
                  type="number"
                  min="0"
                  value={minNotice}
                  onChange={handleChange(setMinNotice)}
                  placeholder="Ej: 5"
                  error={minNotice && parseInt(minNotice, 10) < 0 ? "No puede ser negativo" : undefined}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Vigente desde"
                  type="date"
                  value={effectiveFrom}
                  onChange={handleChange(setEffectiveFrom)}
                />
                <Input
                  label="Vigente hasta (opcional)"
                  type="date"
                  value={effectiveTo}
                  onChange={handleChange(setEffectiveTo)}
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={!isValid} loading={upsertMut.isPending}>
                  <Save size={16} className="mr-2" />
                  {activePolicy ? "Actualizar Política" : "Crear Política"}
                </Button>
              </div>
            </form>
          </>
        )}
      </CardBody>
    </Card>
  );
}
