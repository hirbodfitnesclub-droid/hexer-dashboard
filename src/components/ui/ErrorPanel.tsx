import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from './Button';

interface ErrorPanelProps {
  id: string;
  message: string;
  onRetry?: () => void;
}

/**
 * حالت خطای تصویری + دکمه تلاش مجدد.
 * جایگزین نمایش اشتباه empty-state هنگام خطای شبکه.
 */
export const ErrorPanel: React.FC<ErrorPanelProps> = ({ id, message, onRetry }) => {
  return (
    <div id={id} className="flex flex-col items-center justify-center py-16 px-6 bg-rose-500/[0.04] border border-rose-500/15 rounded-2xl text-center">
      <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-3">
        <AlertCircle className="w-6 h-6" />
      </div>
      <p className="text-sm text-slate-200 font-bold">خطا در دریافت اطلاعات</p>
      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed max-w-md">{message}</p>
      {onRetry && (
        <Button id={`${id}-retry`} variant="secondary" size="sm" onClick={onRetry} className="mt-4">
          تلاش مجدد
        </Button>
      )}
    </div>
  );
};
