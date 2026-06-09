import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label?: string;
  error?: string | null;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  id,
  label,
  error,
  icon,
  className = '',
  ...props
}) => {
  return (
    <div id={`${id}-wrapper`} className="flex flex-col space-y-1.5 w-full">
      {label && (
        <label id={`${id}-label`} htmlFor={id} className="text-xs font-semibold text-slate-300">
          {label}
        </label>
      )}
      <div id={`${id}-box`} className="relative flex items-center">
        {icon && (
          <div id={`${id}-icon-prefix`} className="pointer-events-none absolute right-3 text-slate-400">
            {icon}
          </div>
        )}
        <input
          id={id}
          className={`w-full bg-slate-950 border text-slate-100 placeholder-slate-500 rounded-xl px-4 py-2 text-sm transition-all focus:outline-none focus:ring-1 focus:ring-brand-500/80 ${
            icon ? 'pr-10' : ''
          } ${
            error 
              ? 'border-rose-500/50 focus:border-rose-500' 
              : 'border-slate-800 focus:border-brand-500 hover:border-slate-700'
          } ${className}`}
          {...props}
        />
      </div>
      {error && (
        <p id={`${id}-error-msg`} className="text-xs text-rose-400 font-medium leading-normal">
          {error}
        </p>
      )}
    </div>
  );
};
