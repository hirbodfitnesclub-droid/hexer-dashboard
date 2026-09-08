import React from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface PaginationProps {
  id: string;
  page: number; // 1-indexed
  totalPages: number;
  totalItems: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

/**
 * صفحه‌بندی مشترک RTL برای همه لیست‌های پنل.
 */
export const Pagination: React.FC<PaginationProps> = ({
  id,
  page,
  totalPages,
  totalItems,
  pageSize,
  pageSizeOptions = [20, 50, 100],
  onPageChange,
  onPageSizeChange,
}) => {
  const safeTotal = Math.max(totalPages, 1);
  const current = Math.min(Math.max(page, 1), safeTotal);

  return (
    <div id={id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-800/60 mt-4">
      <p id={`${id}-info`} className="text-[11px] text-slate-500 font-semibold">
        صفحه <span className="text-slate-200 font-mono">{current.toLocaleString('fa-IR')}</span> از{' '}
        <span className="text-slate-200 font-mono">{safeTotal.toLocaleString('fa-IR')}</span>
        {' • '}
        <span className="text-slate-200 font-mono">{totalItems.toLocaleString('fa-IR')}</span> مورد
      </p>

      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <select
            id={`${id}-size`}
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="bg-slate-950 border border-slate-800 rounded-lg text-[11px] text-slate-300 px-2 py-1.5 focus:outline-none focus:border-brand-500 cursor-pointer"
            aria-label="تعداد در هر صفحه"
          >
            {pageSizeOptions.map((s) => (
              <option key={s} value={s}>
                {s.toLocaleString('fa-IR')} در صفحه
              </option>
            ))}
          </select>
        )}

        <button
          id={`${id}-prev`}
          type="button"
          disabled={current <= 1}
          onClick={() => onPageChange(current - 1)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          <ChevronRight className="w-3.5 h-3.5" />
          قبلی
        </button>
        <button
          id={`${id}-next`}
          type="button"
          disabled={current >= safeTotal}
          onClick={() => onPageChange(current + 1)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          بعدی
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
