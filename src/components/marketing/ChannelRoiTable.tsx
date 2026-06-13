import React from 'react';
import { ChannelRoiRow } from '../../lib/supabase';

interface ChannelRoiTableProps {
  data: ChannelRoiRow[];
}

export const ChannelRoiTable: React.FC<ChannelRoiTableProps> = ({ data }) => {
  // Helper to format currency values to Persian numbers (Toman is / 10 from Rial)
  const formatToman = (val: number) => {
    // We assume the db returns IRR (Rials) for financial calculations, so we divide by 10 to display Toman
    const tomanVal = Math.round((val || 0) / 10);
    return `${tomanVal.toLocaleString('fa-IR')} تومان`;
  };

  const formatPercent = (val: number) => {
    return `${Number(val || 0).toFixed(1)}٪`;
  };

  if (!data || data.length === 0) {
    return (
      <div id="roi-empty-state" className="flex items-center justify-center h-[200px] text-slate-500 text-sm font-medium">
        دیتا برای نرخ بازگشت سرمایه کانال‌ها یافت نشد.
      </div>
    );
  }

  return (
    <div id="roi-table-container" className="overflow-x-auto w-full font-sans">
      <table id="roi-table-element" className="w-full text-right border-collapse">
        <thead>
          <tr className="border-b border-slate-800 text-slate-400 text-xs font-bold">
            <th className="py-3 px-4">كانال مارکتینگ</th>
            <th className="py-3 px-4 text-center">بازدیدکننده</th>
            <th className="py-3 px-4 text-center">ثبت‌نام</th>
            <th className="py-3 px-4 text-center">خریدار</th>
            <th className="py-3 px-4 text-center">نرخ تبدیل</th>
            <th className="py-3 px-4 text-center">هزینه‌ی کل</th>
            <th className="py-3 px-4 text-center">شاخص CAC</th>
            <th className="py-3 px-4 text-center text-emerald-400">درآمد کل</th>
            <th className="py-3 px-4 text-center font-bold">عایدی مادی (ROI)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/40">
          {data.map((row) => {
            const isRoiPositive = (row.roi || 0) >= 0;
            return (
              <tr key={row.channel} className="text-sm hover:bg-slate-800/15 transition-colors">
                <td className="py-3.5 px-4 font-semibold text-slate-200">
                  {row.channel === 'direct' ? 'مستقیم (Direct)' : row.channel}
                </td>
                <td className="py-3.5 px-4 text-center font-mono text-slate-400">
                  {(row.visitors || 0).toLocaleString('fa-IR')}
                </td>
                <td className="py-3.5 px-4 text-center font-mono text-slate-400">
                  {(row.registrations || 0).toLocaleString('fa-IR')}
                </td>
                <td className="py-3.5 px-4 text-center font-mono text-slate-400">
                  {(row.buyers || 0).toLocaleString('fa-IR')}
                </td>
                <td className="py-3.5 px-4 text-center font-mono text-indigo-400 font-medium">
                  {formatPercent(row.conversion_rate)}
                </td>
                <td className="py-3.5 px-4 text-center font-mono text-slate-300">
                  {formatToman(row.total_cost)}
                </td>
                <td className="py-3.5 px-4 text-center font-mono text-slate-300">
                  {formatToman(row.cac)}
                </td>
                <td className="py-3.5 px-4 text-center font-mono text-emerald-400 font-medium">
                  {formatToman(row.revenue)}
                </td>
                <td className="py-3.5 px-4 text-center font-mono">
                  <span className={`px-2 py-1 rounded-md text-xs font-bold leading-none ${
                    isRoiPositive 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {isRoiPositive ? '+' : ''}{Number(row.roi || 0).toFixed(1)}٪
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
