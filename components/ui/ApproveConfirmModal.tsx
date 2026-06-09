import React from 'react';
import { ModalWrapper } from './ModalWrapper';
import { Check } from 'lucide-react';

interface ApproveConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  amount?: number;
  userName?: string;
}

export const ApproveConfirmModal: React.FC<ApproveConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  amount,
  userName,
}) => {
  return (
    <ModalWrapper
      id="approve-confirm-modal"
      isOpen={isOpen}
      onClose={onClose}
      title="تایید و فعال‌سازی اشتراک"
    >
      <div id="approve-confirm-body" className="space-y-5 text-center py-2">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
          <Check className="h-6 w-6" />
        </div>
        
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-slate-100">آیا از تایید این پرداخت کارت به کارت اطمینان دارید؟</h4>
          <p className="text-xs text-slate-400 leading-relaxed px-2">
            با تایید این پرداخت، وضعیت فیش به «موفقیت‌آمیز» تغییر کرده و اشتراک متناظر برای {userName ? <span className="text-brand-400 font-bold">{userName}</span> : 'کاربر'} فوراً فعال خواهد شد.
          </p>
          
          {amount && (
            <div className="mt-3 inline-block bg-slate-950/50 border border-white/5 px-4 py-2 rounded-xl">
              <span className="text-xs text-slate-500 block mb-0.5">مبلغ تراکنش:</span>
              <span className="font-mono text-sm font-bold text-emerald-400">
                {(amount / 10).toLocaleString('fa-IR')} <span className="text-[10px] font-sans">تومان</span>
              </span>
            </div>
          )}
        </div>

        <div id="approve-actions-container" className="flex space-x-3 space-x-reverse pt-2">
          <button
            id="confirm-approve-btn"
            type="button"
            className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
            onClick={onConfirm}
          >
            بله، تایید و فعال‌سازی
          </button>
          <button
            id="cancel-approve-btn"
            type="button"
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            onClick={onClose}
          >
            انصراف
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};
