/**
 * واحدهای نمایشی یکدست پنل ادمین.
 *
 * قرارداد: همه مبالغ دیتابیس به ریال (IRR) هستند و UI تومان نشان می‌دهد.
 * همه تاریخ‌ها میلادی ISO هستند و UI شمسی با تایم‌زون تهران نشان می‌دهد.
 */

export const IRR_PER_TOMAN = 10;
export const FA_TIME_ZONE = 'Asia/Tehran';

/** ریال -> تومان (گردشده، بدون اعشار) */
export function toToman(irr: number | null | undefined): number {
  if (irr === null || irr === undefined || Number.isNaN(Number(irr))) return 0;
  return Math.round(Number(irr) / IRR_PER_TOMAN);
}

/** عدد تومان با فرمت فارسی: "۱۲٬۵۰۰ تومان" */
export function formatToman(irr: number | null | undefined, withUnit = true): string {
  const toman = toToman(irr);
  const num = toman.toLocaleString('fa-IR');
  return withUnit ? `${num} تومان` : num;
}

/** تاریخ شمسی کامل (همیشه با سال تا از قاطی شدن روزها جلوگیری شود) */
export function formatFaDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fa-IR', {
      timeZone: FA_TIME_ZONE,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return String(iso);
  }
}

/** تاریخ + ساعت شمسی */
export function formatFaDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fa-IR', {
      timeZone: FA_TIME_ZONE,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

/** کلید گروه‌بندی روزانه یکتا (شامل سال) برای چارت‌ها: "1404/06/12" */
export function faDayKey(iso: string): string {
  try {
    const d = new Date(iso);
    const parts = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
      timeZone: FA_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    return `${get('year')}/${get('month')}/${get('day')}`;
  } catch {
    return String(iso).slice(0, 10);
  }
}

/** لیبل نمایشی روز برای چارت: "۱۲ شهریور" */
export function faDayLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fa-IR', {
      timeZone: FA_TIME_ZONE,
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return String(iso).slice(0, 10);
  }
}
