/**
 * CSV para Excel/Sheets: separador coma, comillas dobles, CRLF y BOM UTF-8 (para
 * que Excel respete los acentos). Las celdas que empiezan con = + - @ (o tab/CR)
 * se prefijan con ' para que la planilla no las ejecute como fórmulas
 * (inyección CSV): los nombres de prospectos y campañas los escribe cualquiera.
 */
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const cell = (v: string | number | null) => {
    if (v === null || v === undefined) return "";
    let s = typeof v === "number" ? String(v) : v;
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const lines = [headers, ...rows].map((r) => r.map(cell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}
