import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface UserGrowthPoint {
  date: string;
  count: number;
}

interface UserGrowthChartProps {
  data: UserGrowthPoint[];
}

export const UserGrowthChart: React.FC<UserGrowthChartProps> = ({ data }) => {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div id="growth-tooltip" className="glass-panel p-3 rounded-xl border border-slate-700/60 shadow-lg text-xs leading-normal">
          <p id="growth-lbl" className="text-slate-400 font-medium mb-1">{payload[0].payload.date}</p>
          <p id="growth-val" className="text-brand-400 font-bold font-mono">
            {payload[0].value.toLocaleString('fa-IR')} کاربر جدید
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div id="user-growth-chart-container" className="w-full relative h-[300px]">
      <div className="absolute inset-0">
        <ResponsiveContainer width="99%" height={300}>
          <AreaChart
            data={data}
            margin={{
              top: 10,
              right: 10,
              left: -10,
              bottom: 0,
            }}
          >
            <defs>
              <linearGradient id="userGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4a6bf2" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#4a6bf2" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 10 }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 10 }}
              dx={-8}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#334155', strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#4a6bf2"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#userGlow)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
