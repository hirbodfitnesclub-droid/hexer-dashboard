import React from 'react';
import { ModalWrapper } from './ModalWrapper';

interface ReceiptViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  amount: number;
}

export const ReceiptViewerModal: React.FC<ReceiptViewerModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  amount,
}) => {
  return (
    <ModalWrapper
      id="receipt-viewer-modal"
      isOpen={isOpen}
      onClose={onClose}
      title="مشاهده فیش رسید بانکی"
      maxWidthClass="max-w-2xl"
    >
      <div id="receipt-modal-body" className="flex flex-col items-center space-y-4">
        {imageUrl ? (
          <div id="receipt-image-container" className="relative w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950 flex justify-center items-center p-2 min-h-[300px]">
            <img
              id="offline-receipt-img"
              src={imageUrl}
              alt="Offline Receipt"
              className="max-h-[500px] object-contain rounded-lg"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : (
          <div id="receipt-image-fallback" className="w-full h-64 flex items-center justify-center rounded-xl border border-slate-800 bg-slate-950 text-slate-400 text-sm font-semibold">
            تصویر فیش یافت نشد یا لینک موقت آن منقضی شده است.
          </div>
        )}
        
        <div id="receipt-amount-display" className="w-full flex justify-between items-center bg-slate-950/40 p-4 rounded-xl border border-white/5">
          <span id="amount-label" className="text-sm text-slate-400 font-semibold">مبلغ تراکنش:</span>
          <span id="amount-value" className="text-base font-bold text-emerald-400">
            {(amount / 10).toLocaleString('fa-IR')} تومان
          </span>
        </div>
      </div>
    </ModalWrapper>
  );
};
