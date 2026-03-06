"use client";

import React from "react";
import { Download, Printer } from "lucide-react";
import Button from "@/components/ui/Button";

interface ExportBarProps {
  onExportCSV: () => void;
  onPrintPDF: () => void;
  loading?: boolean;
}

export default function ExportBar({ onExportCSV, onPrintPDF, loading }: ExportBarProps) {
  return (
    <div className="flex gap-2">
      <Button variant="secondary" size="sm" onClick={onExportCSV} loading={loading}>
        <Download size={16} className="mr-1" />
        Exportar CSV
      </Button>
      <Button variant="ghost" size="sm" onClick={onPrintPDF}>
        <Printer size={16} className="mr-1" />
        Imprimir PDF
      </Button>
    </div>
  );
}
