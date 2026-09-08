import React from 'react';
import { ModalWrapper } from './ModalWrapper';
import { Button } from './Button';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  id: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  isLoading?: boolean;
}

/**
 * مودال تایید مشترک؛ جایگزین confirm() نیتیو مرورگر.
 * دکمه‌ها در حالت لودینگ قفل می‌شوند تا دابل‌کلیک رخ ندهد.
 */
export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  id,
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'تایید',
  cancelLabel = 'انصراف',
  variant = 'primary',
  isLoading = false,
}) => {
  return (
    <ModalWrapper id={id} isOpen={isOpen} onClose={onClose} title={title} maxWidthClass="max-w-md">
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              variant === 'danger'
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                : 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <p className="text-xs text-slate-300 leading-relaxed pt-2">{message}</p>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button id={`${id}-cancel`} type="button" variant="secondary" size="sm" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            id={`${id}-confirm`}
            type="button"
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="sm"
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </ModalWrapper>
  );
};
