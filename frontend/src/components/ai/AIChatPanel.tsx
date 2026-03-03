"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Send, User as UserIcon, RefreshCw, Sparkles, AlertCircle } from "lucide-react";
import api from "@/api/client";
import type { AIChatHistoryItem, UserRole } from "@/types";
import { useAuth } from "@/providers/AuthProvider";
import { formatDateTime } from "@/lib/format";

// ── Role-based configuration ──────────────────────────────────
const ROLE_CONFIG: Record<UserRole, {
  placeholder: string;
  chips: string[];
  color: string;
}> = {
  EMPLOYEE: {
    placeholder: "Pregunta por tu saldo, solicitudes o reglas de vacaciones...",
    chips: [
      "¿Cuántos días me quedan?",
      "¿Cuál es el estado de mi solicitud?",
      "¿Cómo solicito vacaciones?",
      "Mis solicitudes recientes",
    ],
    color: "seekop",
  },
  MANAGER: {
    placeholder: "Pregunta por solicitudes de tu equipo, pendientes o políticas...",
    chips: [
      "Muéstrame solicitudes pendientes",
      "Resumen de mi equipo",
      "Miembros de mi equipo",
      "¿Cuántos días me quedan?",
    ],
    color: "seekop",
  },
  ADMIN: {
    placeholder: "Consulta métricas globales, empleados, riesgos o auditoría...",
    chips: [
      "Resumen global del mes",
      "Empleados con saldo bajo",
      "Solicitudes pendientes globales",
      "Listado de empleados",
    ],
    color: "seekop",
  },
  HR: {
    placeholder: "Consulta información de empleados, solicitudes y balances (solo lectura)...",
    chips: [
      "Resumen global",
      "Listado de empleados",
      "Solicitudes globales",
      "Balances generales",
    ],
    color: "seekop",
  },
};

// ── Utility: clean raw tool prefixes from answers ───────────
function cleanAnswer(text: string): string {
  // Remove [tool_name] prefixes from raw fallback answers
  let cleaned = text.replace(/\[\w+\]\s*/g, "").trim();
  // Remove duplicate newlines
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  return cleaned || text;
}

// ── Typing dots animation ────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-start gap-2.5 mb-3">
      <div className="shrink-0 w-7 h-7 rounded-full bg-seekop-100 flex items-center justify-center">
        <Bot size={14} className="text-seekop-600" />
      </div>
      <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-2.5">
        <div className="flex gap-1 items-center h-5">
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

// ── Message bubble ───────────────────────────────────────────
function UserBubble({ text, time }: { text: string; time?: string }) {
  return (
    <div className="flex items-start gap-2.5 mb-3 flex-row-reverse">
      <div className="shrink-0 w-7 h-7 rounded-full bg-seekop-500 flex items-center justify-center">
        <UserIcon size={14} className="text-white" />
      </div>
      <div className="max-w-[80%]">
        <div className="bg-seekop-500 text-white rounded-2xl rounded-tr-sm px-4 py-2.5">
          <p className="text-sm whitespace-pre-wrap">{text}</p>
        </div>
        {time && <p className="text-[10px] text-gray-400 mt-1 text-right">{time}</p>}
      </div>
    </div>
  );
}

function AssistantBubble({ text, time, tools }: { text: string; time?: string; tools?: string | null }) {
  const displayText = cleanAnswer(text);
  const toolList = tools ? tools.split(",").map((t) => t.trim()).filter(Boolean) : [];

  return (
    <div className="flex items-start gap-2.5 mb-3">
      <div className="shrink-0 w-7 h-7 rounded-full bg-seekop-100 flex items-center justify-center">
        <Bot size={14} className="text-seekop-600" />
      </div>
      <div className="max-w-[80%]">
        <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-2.5">
          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{displayText}</p>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {time && <span className="text-[10px] text-gray-400">{time}</span>}
          {toolList.map((tool) => (
            <span key={tool} className="text-[10px] text-seekop-400 bg-seekop-50 px-1.5 py-0.5 rounded">
              {tool.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────
interface AIChatPanelProps {
  title?: string;
}

export default function AIChatPanel({ title = "Asistente IA" }: AIChatPanelProps) {
  const { user } = useAuth();
  const role = (user?.role ?? "EMPLOYEE") as UserRole;
  const config = ROLE_CONFIG[role] ?? ROLE_CONFIG.EMPLOYEE;

  const userId = user?.id;
  const historyKey = ["ai.chat.history", userId] as const;

  const [question, setQuestion] = useState("");
  const [lastFailedQ, setLastFailedQ] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const qc = useQueryClient();

  // Reset local state when user changes (login/logout)
  useEffect(() => {
    setQuestion("");
    setLastFailedQ(null);
  }, [userId]);

  const historyQ = useQuery({
    queryKey: historyKey,
    queryFn: () => api.ai.history(30),
    enabled: !!userId,
  });

  const askMut = useMutation({
    mutationFn: (q: string) => api.ai.ask(q),
    onSuccess: (res, q) => {
      qc.setQueryData<AIChatHistoryItem[]>([...historyKey], (prev) => {
        const items = prev ?? [];
        return [
          {
            id: Date.now(),
            question: q,
            answer: res.answer,
            scope: res.scope,
            toolsUsed: res.toolResultsUsed?.join(", ") ?? null,
            createdAt: new Date().toISOString(),
          },
          ...items,
        ];
      });
      setQuestion("");
      setLastFailedQ(null);
    },
    onError: (_err, q) => {
      setLastFailedQ(q);
    },
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [historyQ.data, askMut.isPending]);

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text ?? question).trim();
    if (!msg || askMut.isPending) return;
    await askMut.mutateAsync(msg);
  }, [question, askMut]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }, [handleSend]);

  const handleRetry = useCallback(() => {
    if (lastFailedQ) {
      void handleSend(lastFailedQ);
    }
  }, [lastFailedQ, handleSend]);

  const handleChipClick = useCallback((chip: string) => {
    setQuestion(chip);
    void handleSend(chip);
  }, [handleSend]);

  const items = historyQ.data ?? [];
  const reversedItems = [...items].reverse();

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col" style={{ height: "560px" }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-seekop-100 flex items-center justify-center">
            <Sparkles size={16} className="text-seekop-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            <p className="text-[10px] text-gray-400">Consultas sobre vacaciones</p>
          </div>
        </div>
        <span className="text-[10px] font-medium text-seekop-600 bg-seekop-50 px-2 py-1 rounded-full uppercase tracking-wide">
          {role}
        </span>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0" role="log" aria-label="Historial de chat">
        {historyQ.isLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin w-6 h-6 border-2 border-seekop-300 border-t-seekop-600 rounded-full mx-auto mb-2" />
              <p className="text-xs text-gray-400">Cargando historial...</p>
            </div>
          </div>
        )}

        {!historyQ.isLoading && items.length === 0 && !askMut.isPending && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-full bg-seekop-50 flex items-center justify-center mb-3">
              <Bot size={24} className="text-seekop-400" />
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">Hola, soy tu asistente de vacaciones</p>
            <p className="text-xs text-gray-400 mb-4 max-w-xs">
              Puedo ayudarte con consultas sobre saldos, solicitudes, aprobaciones y políticas.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {config.chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleChipClick(chip)}
                  className="text-xs px-3 py-1.5 rounded-full border border-seekop-200 text-seekop-700 bg-seekop-50 hover:bg-seekop-100 transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {reversedItems.map((item) => (
          <React.Fragment key={item.id}>
            <UserBubble text={item.question} time={formatDateTime(item.createdAt)} />
            <AssistantBubble text={item.answer} tools={item.toolsUsed} />
          </React.Fragment>
        ))}

        {askMut.isPending && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Error banner with retry */}
      {askMut.error && (
        <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 bg-red-50">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-700 flex-1">
            {askMut.error instanceof Error ? askMut.error.message : "No se pudo obtener respuesta."}
          </p>
          {lastFailedQ && (
            <button
              type="button"
              onClick={handleRetry}
              className="shrink-0 flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-800 transition-colors"
            >
              <RefreshCw size={12} />
              Reintentar
            </button>
          )}
        </div>
      )}

      {/* Suggestion chips (when there are messages) */}
      {items.length > 0 && !askMut.isPending && (
        <div className="px-4 pb-1 flex gap-1.5 overflow-x-auto shrink-0">
          {config.chips.slice(0, 3).map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => handleChipClick(chip)}
              className="text-[10px] whitespace-nowrap px-2.5 py-1 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="px-4 py-3 border-t border-gray-100 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={config.placeholder}
            rows={1}
            aria-label="Escribe tu mensaje"
            className="flex-1 resize-none px-3 py-2 border border-gray-300 rounded-xl text-sm outline-none transition-colors focus:ring-2 focus:ring-seekop-400 focus:border-seekop-500 max-h-24 overflow-y-auto"
            style={{ minHeight: "40px" }}
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!question.trim() || askMut.isPending}
            aria-label="Enviar mensaje"
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-seekop-500 text-white hover:bg-seekop-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {askMut.isPending ? (
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 text-center">
          Enter para enviar · Shift+Enter nueva línea
        </p>
      </div>
    </div>
  );
}
