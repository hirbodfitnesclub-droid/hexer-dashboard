import React from 'react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
}) => {
  const variantStyles: Record<BadgeVariant, string> = {
    success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    danger: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
    info: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
    neutral: 'bg-slate-800 text-slate-400 border border-slate-700',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold select-none ${variantStyles[variant]}`}>
      {children}
    </span>
  );
};
