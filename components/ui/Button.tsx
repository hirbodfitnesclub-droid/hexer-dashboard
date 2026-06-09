import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  id: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  id,
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 outline-none active:scale-98 disabled:opacity-50 disabled:pointer-events-none cursor-pointer';
  
  const variantClasses = {
    primary: 'bg-brand-500 hover:bg-brand-600 text-white shadow-lg shadow-brand-500/10 hover:shadow-brand-500/25 border border-brand-400/20',
    secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-100 hover:text-white border border-slate-700/80',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/10 border border-rose-500/20',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500/20',
    ghost: 'hover:bg-slate-800 text-slate-400 hover:text-white',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs space-x-1 space-x-reverse',
    md: 'px-4 py-2 text-sm space-x-2 space-x-reverse min-h-[40px]',
    lg: 'px-6 py-3 text-base space-x-3 space-x-reverse min-h-[48px]',
  };

  return (
    <button
      id={id}
      disabled={disabled || isLoading}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span id={`${id}-spinner`} className="w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin ml-2" />
      ) : icon ? (
        <span id={`${id}-icon-wrapper`} className="ml-1.5 flex items-center">{icon}</span>
      ) : null}
      <span id={`${id}-text`}>{children}</span>
    </button>
  );
};
