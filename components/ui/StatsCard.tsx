import React from 'react';
import { Card } from './Card';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatsCardProps {
  id: string;
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
    label: string;
  };
  iconColorClass?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  id,
  title,
  value,
  icon: Icon,
  trend,
  iconColorClass = 'text-brand-400 bg-brand-500/10',
}) => {
  return (
    <Card id={id} hoverable={true} className="flex flex-col justify-between h-full relative overflow-hidden group">
      {/* Dynamic Background subtle glow */}
      <div id={`${id}-glow`} className="absolute -right-4 -top-4 w-24 h-24 bg-brand-500/5 blur-2xl rounded-full group-hover:bg-brand-500/10 transition-all duration-500" />
      
      <div id={`${id}-top`} className="flex items-center justify-between">
        <span id={`${id}-title`} className="text-sm text-slate-400 font-medium">{title}</span>
        <div id={`${id}-icon-wrapper`} className={`p-3 rounded-xl transition-all duration-300 group-hover:scale-110 ${iconColorClass}`}>
          <Icon id={`${id}-icon`} className="w-5 h-5 pointer-events-none" />
        </div>
      </div>

      <div id={`${id}-bottom`} className="mt-4 flex items-end justify-between">
        <div>
          <span id={`${id}-value`} className="text-2xl md:text-3xl font-bold tracking-tight text-white font-mono">
            {value}
          </span>
          {trend && (
            <div id={`${id}-trend`} className="flex items-center mt-2 space-x-1 space-x-reverse text-xs">
              {trend.isPositive ? (
                <TrendingUp id={`${id}-trend-up`} className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <TrendingDown id={`${id}-trend-down`} className="w-3.5 h-3.5 text-rose-400" />
              )}
              <span id={`${id}-trend-val`} className={trend.isPositive ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
              <span id={`${id}-trend-lbl`} className="text-slate-500">{trend.label}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
