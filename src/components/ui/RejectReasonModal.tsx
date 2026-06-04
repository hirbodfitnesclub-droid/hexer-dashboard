import React, { useState } from 'react';
import { ModalWrapper } from './ModalWrapper';

interface RejectReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export const RejectReasonModal: React.FC<RejectReasonModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState('مبلغ ناخوانا است یا عکس فیش نامعتبر است.');

  const defaultReasons = [
    'مبلغ ناخوانا است یا عکس فیش نامعتبر است.',
    'رسید تصویر ارسالی مربوط به تراکنش دیگری است.',
    'مبلغ واریزی کمتر از هزینه پلن انتخاب‌شده می‌باشد.',
    'فیش تکراری ثبت شده است.',
  ];

  return (
    <ModalWrapper
      id="reject-reason-modal"
      isOpen={isOpen}
      onClose={onClose}
      title="علت رد فیش پرداخت"
    >
      <div id="reject-reason-body" className="space-y-4">
        <div>
          <label id="quick-reasons-label" className="block text-xs font-semibold text-slate-400 mb-2">
            انتخاب دلیل پیش‌فرض
          </label>
          <div id="quick-reasons-list" className="grid grid-cols-1 gap-2">
            {defaultReasons.map((r, idx) => (
              <button
                id={`quick-reason-btn-${idx}`}
                key={idx}
                type="button"
                className={`text-right text-xs px-3 py-2.5 rounded-xl border transition-all cursor-pointer ${
                  reason === r
                    ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                    : 'border-white/5 bg-slate-950/20 text-slate-400 hover:bg-slate-800'
                }`}
                onClick={() => setReason(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label id="text-reason-label" className="block text-xs font-semibold text-slate-400 mb-2">
            توضیحات تکمیلی یا ویرایش دلیل
          </label>
          <textarea
            id="reject-reason-textarea"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full h-32 px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:outline-none focus:border-rose-500/50 text-xs text-slate-200 resize-none font-sans"
            placeholder="دلیل رد فیش را مشخص کنید..."
          />
        </div>

        <div id="reject-actions-container" className="flex space-x-3 space-x-reverse pt-2">
          <button
            id="confirm-reject-btn"
            type="button"
            className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
            onClick={() => {
              if (reason.trim()) {
                onConfirm(reason);
              }
            }}
          >
            تایید و رد فیش
          </button>
          <button
            id="cancel-reject-btn"
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
