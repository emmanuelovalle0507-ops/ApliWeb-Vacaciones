"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Send, WandSparkles } from "lucide-react";
import api from "@/api/client";
import type { AIChatHistoryItem } from "@/types";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import { formatDateTime } from "@/lib/format";

interface AIChatPanelProps {
  title?: string;
}

export default function AIChatPanel({ title = "Asistente IA" }: AIChatPanelProps) {
  const [question, setQuestion] = useState("");
  const [policyInstruction, setPolicyInstruction] = useState("");
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

  const historyQ = useQuery({
    queryKey: ["ai.chat.history"],
    queryFn: () => api.ai.history(20),
  });

  const policyMut = useMutation({
    mutationFn: (apply: boolean) =>
      api.teamPolicies.runAgent({
        instruction: policyInstruction,
        apply,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teamPolicies.me"] });
      qc.invalidateQueries({ queryKey: ["teamPolicies.onboarding"] });
    },
  });

  const askMut = useMutation({
    mutationFn: (q: string) => api.ai.ask(q),
    onSuccess: (res, q) => {
      qc.setQueryData<AIChatHistoryItem[]>(["ai.chat.history"], (prev) => {
        const items = prev ?? [];
        return [
          {
            id: Date.now(),
            question: q,
            answer: res.answer,
            scope: res.scope,
            createdAt: new Date().toISOString(),
          },
          ...items,
        ];
      });
      setQuestion("");
    },
  });

  const handleAsk = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) return;
    await askMut.mutateAsync(trimmed);
  };

  const handlePolicyAction = async (apply: boolean) => {
    if (!policyInstruction.trim()) return;
    await policyMut.mutateAsync(apply);
  };

  const items = historyQ.data ?? [];
  const activePolicy = myPolicyQ.data;
  const policyProposal = policyMut.data?.proposal;

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-seekop-500" />
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        <span className="text-xs text-gray-400">Solo consultas de la app</span>
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

        <div className="space-y-3 border border-seekop-100 rounded-lg p-3 bg-seekop-50/40">
          <Textarea
            label="Configurar reglas con IA"
            placeholder="Ej: Desde hoy, máximo 3 personas fuera por día y mínimo 12 días de anticipación"
            value={policyInstruction}
            onChange={(e) => setPolicyInstruction(e.target.value)}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handlePolicyAction(false)}
              loading={policyMut.isPending}
            >
              <WandSparkles size={16} className="mr-2" />
              Proponer
            </Button>
            <Button type="button" onClick={() => void handlePolicyAction(true)} loading={policyMut.isPending}>
              Aplicar regla
            </Button>
          </div>

          {policyProposal ? (
            <div className="p-3 rounded-lg border border-seekop-200 bg-seekop-50 text-sm text-seekop-900">
              <p className="font-medium">{policyMut.data?.message}</p>
              <p className="mt-1">
                Propuesta: máximo <strong>{policyProposal.maxPeopleOffPerDay}</strong> fuera por día, mínimo
                <strong> {policyProposal.minNoticeDays}</strong> días de anticipación.
              </p>
            </div>
          ) : null}

          {policyMut.error ? (
            <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
              {policyMut.error instanceof Error ? policyMut.error.message : "No se pudo procesar la regla."}
            </div>
          ) : null}
        </div>

        <form onSubmit={handleAsk} className="space-y-3">
          <Textarea
            label="Pregunta"
            placeholder="Ej: ¿quién no va a estar el siguiente mes?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <div className="flex justify-end">
            <Button type="submit" loading={askMut.isPending}>
              <Send size={16} className="mr-2" />
              Preguntar
            </Button>
          </div>
          {askMut.error && (
            <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
              {askMut.error instanceof Error ? askMut.error.message : "No se pudo obtener respuesta."}
            </div>
          )}
        </form>

        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {historyQ.isLoading && (
            <p className="text-sm text-gray-500">Cargando historial...</p>
          )}

          {!historyQ.isLoading && items.length === 0 && (
            <p className="text-sm text-gray-500">Sin historial todavía. Haz la primera pregunta.</p>
          )}

          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs text-gray-400 mb-1">{formatDateTime(item.createdAt)} · {item.scope}</p>
              <p className="text-sm font-medium text-gray-900">{item.question}</p>
              <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{item.answer}</p>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
