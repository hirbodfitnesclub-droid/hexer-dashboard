import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface PlanDataPoint {
  name: string;
  value: number;
}

interface PlanDistributionChartProps {
  data: PlanDataPoint[];
}

export const PlanDistributionChart: React.FC<PlanDistributionChartProps> = ({ data }) => {
  const COLORS = ['#64748b', '#4a6bf2', '#a855f7', '#10b981'];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div id="plan-tooltip" className="glass-panel p-2.5 rounded-xl border border-slate-700/60 shadow-md text-xs leading-none">
          <span id="plan-tooltip-name" className="text-slate-300 font-medium">{payload[0].name}: </span>
          <span id="plan-tooltip-val" className="font-bold text-white font-mono">{payload[0].value} کاربر</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div id="plan-distribution-chart-container" className="h-[300px] w-full flex flex-col justify-center">
      <div id="chart-wrap" style={{ width: '100%', height: 300, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend built to support fully customized RTL placement */}
      <div id="legend-wrap" className="flex items-center justify-center gap-4 mt-2 flex-wrap">
        {data.map((entry, index) => (
          <div id={`legend-item-${index}`} key={entry.name} className="flex items-center space-x-1.5 space-x-reverse text-xs">
            <span
              id={`color-box-${index}`}
              className="w-3.5 h-3.5 rounded-md"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span id={`lbl-${index}`} className="text-slate-400">{entry.name}</span>
            <span id={`val-${index}`} className="text-slate-200 font-bold font-mono">({entry.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
};
