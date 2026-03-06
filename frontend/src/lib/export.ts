/**
 * Client-side export utilities for CSV download and PDF print.
 */

/** Trigger a CSV file download from a string. Uses UTF-8 BOM for Excel compatibility. */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Open the browser print dialog (can be saved as PDF). */
export function printAsPDF(): void {
  window.print();
}
