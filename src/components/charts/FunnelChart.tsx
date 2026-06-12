import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { FunnelStageRow } from '../../lib/supabase';

interface FunnelChartProps {
  data: FunnelStageRow[];
}

const STAGE_LABELS: Record<string, string> = {
  'visit': '۱. بازدید لندینگ',
  'cta_click': '۲. کلیک روی CTA',
  'register': '۳. ثبت‌نام کاربر',
  'free_start': '۴. شروع دوره رایگان',
  'purchase': '۵. خرید نهایی اشتراک',
};

// Brand gradient colors
const COLORS = [
  '#4f46e5', // INDIGO 600
  '#6366f1', // INDIGO 500
  '#818cf8', // INDIGO 400
  '#a5b4fc', // INDIGO 300
  '#10b981', // EMERALD 500 (Success converting)
];

export const FunnelChart: React.FC<FunnelChartProps> = ({ data }) => {
  // Translate is needed for nicer Persian UI
  const processedData = data.map((item, index) => ({
    ...item,
    stageLabel: STAGE_LABELS[item.stage] || item.stage,
    color: COLORS[index % COLORS.length],
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const row = payload[0].payload;
      return (
        <div id="funnel-tooltip" className="glass-panel p-3 rounded-xl border border-slate-700/60 shadow-lg text-xs leading-normal">
          <p id="funnel-tooltip-stage" className="text-white font-bold mb-1">{row.stageLabel}</p>
          <p id="funnel-tooltip-count" className="text-slate-300">
            تعداد: <span className="font-mono text-indigo-400 font-bold">{row.count.toLocaleString('fa-IR')}</span> کاربر
          </p>
          <p id="funnel-tooltip-conversion" className="text-emerald-400 font-medium">
            نرخ تبدیل مرحله: <span className="font-mono font-bold">{Number(row.conversion_percentage).toFixed(1)}٪</span>
          </p>
        </div>
      );
    }
    return null;
  };

  if (!data || data.length === 0) {
    return (
      <div id="funnel-empty-state" className="flex items-center justify-center h-[300px] text-slate-500 text-sm font-medium">
        دیتا برای قیف تبدیل یافت نشد.
      </div>
    );
  }

  return (
    <div id="funnel-chart-wrapper" className="w-full relative h-[320px] font-sans">
      <div className="absolute inset-0">
        <ResponsiveContainer width="99%" height={320}>
          <BarChart
            layout="vertical"
            data={processedData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={true} vertical={false} />
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickFormatter={(value) => value.toLocaleString('fa-IR')}
            />
            <YAxis
              type="category"
              dataKey="stageLabel"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#cbd5e1', fontSize: 11, fontWeight: 500 }}
              width={120}
              orientation="right"
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }} />
            <Bar
              dataKey="count"
              radius={[0, 8, 8, 0]}
              barSize={24}
            >
              {processedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
