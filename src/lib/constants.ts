import { Award, Rocket, Shield, Zap } from 'lucide-react';
import React from 'react';

export interface PlanConfig {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  colorClass: string;
  badgeClass: string;
  filterClass: string;
  textColorClass: string;
}

export const PLAN_CONFIGS: Record<string, PlanConfig> = {
  free: {
    id: 'free',
    name: 'رایگان',
    icon: Award,
    colorClass: 'text-slate-500',
    badgeClass: 'bg-slate-800 text-slate-400 border border-slate-700/80',
    filterClass: 'bg-slate-500/10 text-slate-400',
    textColorClass: 'text-slate-400',
  },
  starter: {
    id: 'starter',
    name: 'استارتر',
    icon: Rocket,
    colorClass: 'text-blue-400',
    badgeClass: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    filterClass: 'bg-blue-500/10 text-blue-400',
    textColorClass: 'text-blue-400',
  },
  plus: {
    id: 'plus',
    name: 'پلاس',
    icon: Shield,
    colorClass: 'text-purple-400',
    badgeClass: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
    filterClass: 'bg-purple-500/10 text-purple-400',
    textColorClass: 'text-purple-400',
  },
  pro: {
    id: 'pro',
    name: 'پرو',
    icon: Zap,
    colorClass: 'text-brand-400',
    badgeClass: 'bg-brand-500/10 text-brand-400 border border-brand-500/20',
    filterClass: 'bg-brand-500/10 text-brand-400',
    textColorClass: 'text-brand-400',
  },
};
