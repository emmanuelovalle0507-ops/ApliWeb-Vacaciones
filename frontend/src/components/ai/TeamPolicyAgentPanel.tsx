"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings2, WandSparkles } from "lucide-react";
import api from "@/api/client";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";

interface TeamPolicyAgentPanelProps {
  title?: string;
}

export default function TeamPolicyAgentPanel({ title = "Configuración de reglas por IA" }: TeamPolicyAgentPanelProps) {
  const [instruction, setInstruction] = useState("");
  const qc = useQueryClient();

  const onboardingQ = useQuery({
    queryKey: ["teamPolicies.onboarding"],
    queryFn: () => api.teamPolicies.getOnboardingQuestions(),
  });

  const myPolicyQ = useQuery({
    queryKey: ["teamPolicies.me"],
    queryFn: () => api.teamPolicies.getMy(),
    retry: false,
  });

  const runAgentMut = useMutation({
    mutationFn: (apply: boolean) =>
      api.teamPolicies.runAgent({
        instruction,
        apply,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teamPolicies.me"] });
      qc.invalidateQueries({ queryKey: ["teamPolicies.onboarding"] });
    },
  });

  const handleRun = async (apply: boolean) => {
    if (!instruction.trim()) return;
    await runAgentMut.mutateAsync(apply);
  };

  const proposal = runAgentMut.data?.proposal;
  const activePolicy = myPolicyQ.data;

  return (
    <Card>
      <CardHeader className="flex items-center gap-2">
        <Settings2 size={18} className="text-seekop-500" />
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </CardHeader>
      <CardBody className="space-y-4">
        {!onboardingQ.data?.hasActivePolicy && onboardingQ.data?.questions?.length ? (
          <div className="p-3 rounded-lg border border-amber-200 bg-amber-50">
            <p className="text-sm font-medium text-amber-900">Onboarding inicial de reglas</p>
            <ul className="list-disc ml-5 mt-2 text-sm text-amber-800 space-y-1">
              {onboardingQ.data.questions.map((q, idx) => (
                <li key={`${idx}-${q}`}>{q}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {activePolicy ? (
          <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700">
            <p>
              Regla activa: máximo <strong>{activePolicy.maxPeopleOffPerDay}</strong> fuera por día, mínimo de
              <strong> {activePolicy.minNoticeDays}</strong> días de anticipación.
            </p>
          </div>
        ) : null}

        <Textarea
          label="Instrucción al agente"
          placeholder="Ej: Desde hoy, máximo 3 personas fuera por día y mínimo 12 días de anticipación"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
        />

        <div className="flex flex-wrap gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={() => void handleRun(false)} loading={runAgentMut.isPending}>
            <WandSparkles size={16} className="mr-2" />
            Generar propuesta
          </Button>
          <Button type="button" onClick={() => void handleRun(true)} loading={runAgentMut.isPending}>
            Aplicar con IA
          </Button>
        </div>

        {runAgentMut.data && proposal ? (
          <div className="p-3 rounded-lg border border-seekop-200 bg-seekop-50 text-sm text-seekop-900">
            <p className="font-medium">{runAgentMut.data.message}</p>
            <p className="mt-1">
              Propuesta: máximo <strong>{proposal.maxPeopleOffPerDay}</strong> fuera por día, mínimo
              <strong> {proposal.minNoticeDays}</strong> días de anticipación.
            </p>
            {proposal.notes?.length ? (
              <ul className="list-disc ml-5 mt-2 space-y-1">
                {proposal.notes.map((note, idx) => (
                  <li key={`${idx}-${note}`}>{note}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {runAgentMut.error ? (
          <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
            {runAgentMut.error instanceof Error ? runAgentMut.error.message : "No se pudo procesar la instrucción."}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
