export function toCSV(rows: (string | number)[][]): string {
  return rows
    .map((r) => r.map((v) => (typeof v === 'string' && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : String(v))).join(','))
    .join('\n');
}

export function download(filename: string, text: string, mime = 'text/csv') {
  const blob = new Blob([text], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Minimal CSV parser for numeric tables with a header row. */
export function parseNumericCSV(text: string): { header: string[]; rows: number[][] } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  if (!lines.length) return { header: [], rows: [] };
  const header = lines[0].split(/[,;\t]/).map((h) => h.trim().toLowerCase());
  const rows = lines.slice(1).map((l) => l.split(/[,;\t]/).map((v) => Number(v.trim()))).filter((r) => r.every((v) => Number.isFinite(v)));
  return { header, rows };
}
