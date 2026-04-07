"use client";

import React, { useCallback, useRef, useState } from "react";
import { Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Loader2, Eye, Undo2, ArrowRight } from "lucide-react";
import Button from "@/components/ui/Button";
import api from "@/api/client";
import type { BulkImportResponse, BulkImportResult, BulkPreviewResponse } from "@/api/real/client";

type ImportStep = "upload" | "previewing" | "preview" | "processing" | "results";

export default function BulkImportPanel({ onImportComplete }: { onImportComplete?: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ImportStep>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<BulkPreviewResponse | null>(null);
  const [response, setResponse] = useState<BulkImportResponse | null>(null);
  const [rollbackDone, setRollbackDone] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);

  const handleDownloadTemplate = async () => {
    try {
      await api.bulkImport.downloadTemplate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al descargar plantilla");
    }
  };

  const handleFileSelect = (file: File) => {
    setError(null);
    if (!file.name.endsWith(".xlsx")) {
      setError("Solo se aceptan archivos Excel (.xlsx).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("El archivo excede el tamaño máximo de 5 MB.");
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  // PASO 2: Preview (validar sin crear)
  const handlePreview = async () => {
    if (!selectedFile) return;
    setStep("previewing");
    setError(null);
    try {
      const result = await api.bulkImport.previewImport(selectedFile);
      setPreview(result);
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al validar archivo");
      setStep("upload");
    }
  };

  // PASO 3: Confirmar e importar
  const handleConfirmImport = async () => {
    if (!selectedFile) return;
    setStep("processing");
    setError(null);
    try {
      const result = await api.bulkImport.importEmployees(selectedFile);
      setResponse(result);
      setStep("results");
      setRollbackDone(false);
      if (result.created > 0) onImportComplete?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al procesar archivo");
      setStep("preview");
    }
  };

  // ROLLBACK
  const handleRollback = async () => {
    if (!response?.batch_id) return;
    setRollingBack(true);
    try {
      await api.bulkImport.rollbackImport(response.batch_id);
      setRollbackDone(true);
      onImportComplete?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al revertir importación");
    } finally {
      setRollingBack(false);
    }
  };

  const handleDownloadResults = () => {
    if (!response?.result_file_b64) return;
    const byteChars = atob(response.result_file_b64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resultado_importacion.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setStep("upload");
    setSelectedFile(null);
    setPreview(null);
    setResponse(null);
    setError(null);
    setRollbackDone(false);
  };

  const statusIcon = (s: BulkImportResult["status"]) => {
    if (s === "CREADO") return <CheckCircle2 size={16} className="text-emerald-500" />;
    if (s === "VÁLIDO") return <CheckCircle2 size={16} className="text-blue-500" />;
    if (s === "ERROR") return <XCircle size={16} className="text-red-500" />;
    return <AlertTriangle size={16} className="text-amber-500" />;
  };

  const statusColor = (s: BulkImportResult["status"]) => {
    if (s === "CREADO") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (s === "VÁLIDO") return "bg-blue-50 text-blue-700 border-blue-200";
    if (s === "ERROR") return "bg-red-50 text-red-700 border-red-200";
    return "bg-amber-50 text-amber-700 border-amber-200";
  };

  const ResultsTable = ({ results }: { results: BulkImportResult[] }) => (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="max-h-[400px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Fila</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Nombre</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Rol</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Equipo</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Estado</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {results.map((r, idx) => (
              <tr key={idx} className={r.status === "ERROR" ? "bg-red-50/50" : r.status === "VÁLIDO" ? "bg-blue-50/30" : ""}>
                <td className="px-4 py-2.5 text-gray-500">{r.row}</td>
                <td className="px-4 py-2.5 font-medium text-gray-900">{r.name}</td>
                <td className="px-4 py-2.5 text-gray-600">{r.email}</td>
                <td className="px-4 py-2.5 text-gray-600">{r.role}</td>
                <td className="px-4 py-2.5 text-gray-600">{r.team}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${statusColor(r.status)}`}>
                    {statusIcon(r.status)}
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[250px] truncate" title={r.detail}>
                  {r.detail}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Importación Masiva de Empleados</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Sube un archivo Excel con los datos de los empleados para crear sus cuentas y calcular sus vacaciones automáticamente.
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs font-medium">
        {[
          { key: "upload", label: "1. Subir archivo" },
          { key: "preview", label: "2. Previsualizar" },
          { key: "results", label: "3. Resultados" },
        ].map((s, i) => {
          const active = step === s.key || (s.key === "preview" && step === "previewing") || (s.key === "results" && step === "processing");
          const done =
            (s.key === "upload" && step !== "upload") ||
            (s.key === "preview" && (step === "processing" || step === "results"));
          return (
            <React.Fragment key={s.key}>
              {i > 0 && <div className={`h-px flex-1 ${done ? "bg-emerald-400" : "bg-gray-200"}`} />}
              <span className={`px-3 py-1.5 rounded-full border ${
                done ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                active ? "bg-[#002a7f]/10 text-[#002a7f] border-[#002a7f]/20" :
                "bg-gray-50 text-gray-400 border-gray-200"
              }`}>
                {done ? <CheckCircle2 size={12} className="inline mr-1" /> : null}
                {s.label}
              </span>
            </React.Fragment>
          );
        })}
      </div>

      {/* ═══ STEP 1: Upload ═══ */}
      {step === "upload" && (
        <div className="space-y-4">
          <div className="bg-[#002a7f]/5 border border-[#002a7f]/15 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet size={20} className="text-[#002a7f]" />
              <div>
                <p className="text-sm font-medium text-gray-900">Descarga la plantilla</p>
                <p className="text-xs text-gray-500">Llénala con los datos de los empleados siguiendo las instrucciones incluidas.</p>
              </div>
            </div>
            <Button variant="secondary" onClick={handleDownloadTemplate} className="shrink-0">
              <Download size={16} className="mr-2" />
              Descargar plantilla
            </Button>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Upload size={16} className="text-[#002a7f]" />
              Sube el archivo completado
            </p>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragOver ? "border-[#002a7f] bg-[#002a7f]/5"
                  : selectedFile ? "border-emerald-300 bg-emerald-50"
                  : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
              />
              {selectedFile ? (
                <div className="space-y-2">
                  <FileSpreadsheet size={40} className="mx-auto text-emerald-500" />
                  <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB — Listo para validar</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload size={40} className="mx-auto text-gray-400" />
                  <p className="text-sm text-gray-600">
                    Arrastra el archivo aquí o <span className="text-[#002a7f] font-medium">haz clic para seleccionar</span>
                  </p>
                  <p className="text-xs text-gray-400">Solo archivos .xlsx (máx. 5 MB, máx. 500 empleados)</p>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-red-700">
              <XCircle size={16} />
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Campos obligatorios</p>
              <p className="text-sm text-gray-700 mt-1">Nombre, email, rol, equipo, fecha ingreso</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cálculo automático</p>
              <p className="text-sm text-gray-700 mt-1">Vacaciones según LFT México (2023)</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contraseñas</p>
              <p className="text-sm text-gray-700 mt-1">Únicas por empleado, descargables en Excel</p>
            </div>
          </div>

          {selectedFile && (
            <div className="flex justify-end">
              <Button onClick={handlePreview}>
                <Eye size={16} className="mr-2" />
                Validar y previsualizar
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ═══ STEP 1.5: Previewing (loading) ═══ */}
      {step === "previewing" && (
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <Loader2 size={48} className="text-[#002a7f] animate-spin" />
          <div className="text-center">
            <p className="text-lg font-medium text-gray-900">Validando archivo...</p>
            <p className="text-sm text-gray-500 mt-1">Verificando datos sin crear cuentas aún</p>
          </div>
        </div>
      )}

      {/* ═══ STEP 2: Preview ═══ */}
      {step === "preview" && preview && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-blue-700">{preview.valid}</p>
              <p className="text-sm text-blue-600 mt-1">Listos para importar</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-red-700">{preview.errors}</p>
              <p className="text-sm text-red-600 mt-1">Con errores</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-gray-700">{preview.total}</p>
              <p className="text-sm text-gray-600 mt-1">Total detectados</p>
            </div>
          </div>

          {/* Warning if errors */}
          {preview.errors > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-amber-700">
              <AlertTriangle size={16} />
              Se encontraron {preview.errors} fila(s) con errores. Solo se importarán las {preview.valid} fila(s) válidas.
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-red-700">
              <XCircle size={16} />
              {error}
            </div>
          )}

          <ResultsTable results={preview.results} />

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="secondary" onClick={handleReset}>
              Cancelar
            </Button>
            <div className="flex gap-3">
              {preview.valid > 0 && (
                <Button onClick={handleConfirmImport}>
                  <ArrowRight size={16} className="mr-2" />
                  Confirmar e importar {preview.valid} empleado(s)
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ STEP 2.5: Processing (loading) ═══ */}
      {step === "processing" && (
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <Loader2 size={48} className="text-[#002a7f] animate-spin" />
          <div className="text-center">
            <p className="text-lg font-medium text-gray-900">Importando empleados...</p>
            <p className="text-sm text-gray-500 mt-1">Creando cuentas, asignando equipos y calculando vacaciones</p>
          </div>
        </div>
      )}

      {/* ═══ STEP 3: Results ═══ */}
      {step === "results" && response && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-emerald-700">{response.created}</p>
              <p className="text-sm text-emerald-600 mt-1">Creados exitosamente</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-red-700">{response.errors}</p>
              <p className="text-sm text-red-600 mt-1">Con errores</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-gray-700">{response.total}</p>
              <p className="text-sm text-gray-600 mt-1">Total procesados</p>
            </div>
          </div>

          {/* Rollback banner */}
          {response.created > 0 && !rollbackDone && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Undo2 size={20} className="text-amber-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    ¿Algo salió mal? Puedes revertir esta importación
                  </p>
                  <p className="text-xs text-gray-500">
                    Se desactivarán los {response.created} usuario(s) creados en este lote.
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={handleRollback}
                disabled={rollingBack}
                className="shrink-0 text-amber-700 border-amber-300 hover:bg-amber-100"
              >
                {rollingBack ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Undo2 size={16} className="mr-2" />}
                Deshacer importación
              </Button>
            </div>
          )}

          {/* Rollback done */}
          {rollbackDone && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-blue-700">
              <CheckCircle2 size={16} />
              Importación revertida exitosamente. Los usuarios fueron desactivados.
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-red-700">
              <XCircle size={16} />
              {error}
            </div>
          )}

          {/* Download results */}
          {response.result_file_b64 && (
            <div className="bg-[#9ab236]/10 border border-[#9ab236]/30 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileSpreadsheet size={20} className="text-[#6f8425]" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Archivo de resultados listo</p>
                  <p className="text-xs text-gray-500">
                    Contiene las contraseñas temporales de cada empleado creado. Descárgalo y compártelo con confidencialidad.
                  </p>
                </div>
              </div>
              <Button variant="secondary" onClick={handleDownloadResults} className="shrink-0">
                <Download size={16} className="mr-2" />
                Descargar resultado
              </Button>
            </div>
          )}

          <ResultsTable results={response.results} />

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={handleReset}>
              Nueva importación
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
