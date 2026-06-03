import React, { useState } from 'react';
import { DiscountCode } from '../../lib/supabase';
import { ModalWrapper } from './ModalWrapper';
import { Input } from './Input';
import { Button } from './Button';
import { Tag, Percent, BarChart3, CalendarDays } from 'lucide-react';
import toast from 'react-hot-toast';

interface DiscountCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (discount: DiscountCode) => void;
}

export const DiscountCreateModal: React.FC<DiscountCreateModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [code, setCode] = useState('');
  const [percent, setPercent] = useState('30');
  const [maxUses, setMaxUses] = useState('100');
  const [expiresAt, setExpiresAt] = useState('');

  const handleGenerateCode = () => {
    // Generate a beautiful, high-quality, professional code string
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = 'HEXER';
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCode(result);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim()) {
      toast.error('وارد کردن کد تخفیف الزامی است.');
      return;
    }

    const discountValue = parseInt(percent);
    if (isNaN(discountValue) || discountValue < 1 || discountValue > 100) {
      toast.error('درصد تخفیف معتبر نیست (باید بین ۱ تا ۱۰۰ باشد).');
      return;
    }

    const usages = parseInt(maxUses);
    if (isNaN(usages) || usages < 1) {
      toast.error('تعداد مجاز استفاده باید حداقل ۱ باشد.');
      return;
    }

    const finalExpires = expiresAt ? new Date(expiresAt).toISOString() : null;

    const newDiscount: DiscountCode = {
      code: code.trim().toUpperCase(),
      discount_percent: discountValue,
      max_uses: usages,
      used_count: 0,
      expires_at: finalExpires,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    onConfirm(newDiscount);
    
    // Reset state
    setCode('');
    setPercent('30');
    setMaxUses('100');
    setExpiresAt('');
  };

  return (
    <ModalWrapper
      id="discount-create-modal"
      title="ایجاد كد تخفیف جدید"
      isOpen={isOpen}
      onClose={onClose}
    >
      <form id="create-discount-form" onSubmit={handleSubmit} className="space-y-5">
        
        {/* Code input with trigger generator */}
        <div id="code-generation-layout" className="space-y-1.5 w-full">
          <label className="text-xs font-semibold text-slate-300">کد تخفیف اختصاصی</label>
          <div className="flex items-center gap-2.5">
            <div className="flex-1">
              <Input
                id="discount-code-input"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="مثال: HEXER40"
                icon={<Tag className="w-4 h-4 text-slate-500" />}
                required
              />
            </div>
            <button
              id="generate-code-btn"
              type="button"
              onClick={handleGenerateCode}
              className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-200 border border-slate-700/80 rounded-xl min-h-[40px] truncate transition-all cursor-pointer"
            >
              ایجاد کد رندوم پورتابل
            </button>
          </div>
        </div>

        {/* Percent input & max uses inputs */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            id="discount-percent-input"
            label="میزان درصد تخفیف (۱ الی ۱۰۰)"
            type="number"
            min={1}
            max={100}
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            icon={<Percent className="w-4 h-4 text-slate-500" />}
            required
          />

          <Input
            id="discount-max-uses-input"
            label="سقف مجاز مجاز استفاده"
            type="number"
            min={1}
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            icon={<BarChart3 className="w-4 h-4 text-slate-500" />}
            required
          />
        </div>

        {/* Date expiry picker */}
        <Input
          id="discount-expires-at-input"
          label="تاریخ انقضا کد تخفیف (میلادی، خالی برای بدون انقضاء)"
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          icon={<CalendarDays className="w-4 h-4 text-slate-500" />}
        />

        {/* Form popup operations pairing buttons */}
        <div id="create-modal-actions" className="flex items-center justify-end gap-3 pt-2">
          <Button id="cancel-create-discount" type="button" variant="secondary" onClick={onClose}>
            انصراف
          </Button>
          <Button id="submit-create-discount" type="submit" variant="primary">
            تولید و ثبت نهایی کد تخفیف
          </Button>
        </div>

      </form>
    </ModalWrapper>
  );
};
