import * as XLSX from "xlsx";

export function exportToExcel(data: Record<string, unknown>[], filename: string, sheetName = "Dados") {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return `${(value * 100).toFixed(2)}%`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export const MONTHS = [
  { key: "janeiro", label: "Jan" },
  { key: "fevereiro", label: "Fev" },
  { key: "marco", label: "Mar" },
  { key: "abril", label: "Abr" },
  { key: "maio", label: "Mai" },
  { key: "junho", label: "Jun" },
  { key: "julho", label: "Jul" },
  { key: "agosto", label: "Ago" },
  { key: "setembro", label: "Set" },
  { key: "outubro", label: "Out" },
  { key: "novembro", label: "Nov" },
  { key: "dezembro", label: "Dez" },
] as const;

export const MONTHS_FULL = [
  { key: "janeiro", label: "Janeiro" },
  { key: "fevereiro", label: "Fevereiro" },
  { key: "marco", label: "Março" },
  { key: "abril", label: "Abril" },
  { key: "maio", label: "Maio" },
  { key: "junho", label: "Junho" },
  { key: "julho", label: "Julho" },
  { key: "agosto", label: "Agosto" },
  { key: "setembro", label: "Setembro" },
  { key: "outubro", label: "Outubro" },
  { key: "novembro", label: "Novembro" },
  { key: "dezembro", label: "Dezembro" },
] as const;
