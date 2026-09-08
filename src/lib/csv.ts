/**
 * خروجی CSV فارسی سازگار با Excel (با BOM).
 * عمداً بدون وابستگی جدید؛ برای نیاز فعلی پنل کافی است.
 */

function escapeCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  // اگر شامل کاما/کوتیشن/خط جدید بود، داخل کوتیشن بگذار
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportToCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): void {
  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ];
  // BOM برای باز شدن درست فارسی در Excel
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
