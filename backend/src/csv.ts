// Minimal RFC 4180 CSV writer.

// Cells starting with these can run as formulas when opened in Excel/Sheets
// ("CSV injection"); prefixing a quote makes them plain text.
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (typeof value === 'string' && FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  // BOM so Excel opens UTF-8 (₹, emoji, non-English notes) correctly
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
