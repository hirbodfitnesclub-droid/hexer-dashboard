import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  message = 'در حال دریافت اطلاعات...' 
}) => {
  const sizeClasses = {
    sm: 'w-5 h-5 border-2',
    md: 'w-10 h-10 border-3',
    lg: 'w-16 h-16 border-4',
  };

  return (
    <div id="loading-spinner-container" className="flex flex-col items-center justify-center p-8 space-y-4">
      <div 
        id="spinner-ring" 
        className={`${sizeClasses[size]} border-slate-700 border-t-brand-500 rounded-full animate-spin`}
      />
      {message && (
        <span id="spinner-message" className="text-xs text-slate-400 font-medium tracking-wide">
          {message}
        </span>
      )}
    </div>
  );
};
