import React from 'react';
import { RetentionRow } from '../../lib/supabase';

interface RetentionMatrixProps {
  data: RetentionRow[];
}

export const RetentionMatrix: React.FC<RetentionMatrixProps> = ({ data }) => {
  // Helper to get color intensity based on retention percentage (0 - 100)
  const getHeatmapColorClass = (rate: number) => {
    const safeRate = rate || 0;
    if (safeRate >= 60) return 'bg-emerald-500/90 text-white font-bold';
    if (safeRate >= 40) return 'bg-emerald-500/70 text-slate-100';
    if (safeRate >= 25) return 'bg-emerald-500/40 text-emerald-200';
    if (safeRate >= 10) return 'bg-emerald-500/20 text-emerald-300/70';
    if (safeRate > 0) return 'bg-emerald-500/10 text-emerald-400/50';
    return 'bg-slate-800/40 text-slate-500 font-mono';
  };

  const formatRate = (rate: number) => {
    return `${Number(rate || 0).toFixed(1)}٪`;
  };

  if (!data || data.length === 0) {
    return (
      <div id="retention-empty-state" className="flex items-center justify-center h-[200px] text-slate-500 text-sm font-medium">
        دیتا برای تحلیل ماندگاری کوهورت یافت نشد.
      </div>
    );
  }

  return (
    <div id="retention-matrix-container" className="overflow-x-auto w-full font-sans">
      <table id="retention-table" className="w-full text-right border-collapse">
        <thead>
          <tr className="border-b border-slate-800 text-slate-400 text-xs font-bold">
            <th className="py-3 px-4">کانال ورودی</th>
            <th className="py-3 px-4 text-center">کاربران ثبت‌شده</th>
            <th className="py-3 px-4 text-center">ماه ۱</th>
            <th className="py-3 px-4 text-center">ماه ۲</th>
            <th className="py-3 px-4 text-center">ماه ۳</th>
            <th className="py-3 px-4 text-center">ماه ۶</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/40">
          {data.map((row) => (
            <tr key={row.channel} className="text-sm hover:bg-slate-800/15 transition-colors">
              <td className="py-3.5 px-4 font-semibold text-slate-200">
                {row.channel === 'direct' ? 'مستقیم (Direct)' : row.channel}
              </td>
              <td className="py-3.5 px-4 text-center font-mono text-slate-400">
                {(row.total_users || 0).toLocaleString('fa-IR')}
              </td>
              
              {/* Month 1 */}
              <td className="py-2 px-1 text-center font-mono">
                <div className={`py-2 rounded-lg mx-auto max-w-[80px] text-xs transition-transform hover:scale-105 ${getHeatmapColorClass(row.retention_rate_m1)}`}>
                  {formatRate(row.retention_rate_m1)}
                  <div className="text-[9px] opacity-75 font-sans mt-0.5">
                    ({(row.retained_m1 || 0).toLocaleString('fa-IR')})
                  </div>
                </div>
              </td>

              {/* Month 2 */}
              <td className="py-2 px-1 text-center font-mono">
                <div className={`py-2 rounded-lg mx-auto max-w-[80px] text-xs transition-transform hover:scale-105 ${getHeatmapColorClass(row.retention_rate_m2)}`}>
                  {formatRate(row.retention_rate_m2)}
                  <div className="text-[9px] opacity-75 font-sans mt-0.5">
                    ({(row.retained_m2 || 0).toLocaleString('fa-IR')})
                  </div>
                </div>
              </td>

              {/* Month 3 */}
              <td className="py-2 px-1 text-center font-mono">
                <div className={`py-2 rounded-lg mx-auto max-w-[80px] text-xs transition-transform hover:scale-105 ${getHeatmapColorClass(row.retention_rate_m3)}`}>
                  {formatRate(row.retention_rate_m3)}
                  <div className="text-[9px] opacity-75 font-sans mt-0.5">
                    ({(row.retained_m3 || 0).toLocaleString('fa-IR')})
                  </div>
                </div>
              </td>

              {/* Month 6 */}
              <td className="py-2 px-1 text-center font-mono">
                <div className={`py-2 rounded-lg mx-auto max-w-[80px] text-xs transition-transform hover:scale-105 ${getHeatmapColorClass(row.retention_rate_m6)}`}>
                  {formatRate(row.retention_rate_m6)}
                  <div className="text-[9px] opacity-75 font-sans mt-0.5">
                    ({(row.retained_m6 || 0).toLocaleString('fa-IR')})
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
