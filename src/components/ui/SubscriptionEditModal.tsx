import React, { useState, useEffect } from 'react';
import { Subscription, Plan } from '../../lib/supabase';
import { ModalWrapper } from './ModalWrapper';
import { Input } from './Input';
import { Button } from './Button';
import { CalendarDays } from 'lucide-react';
import { PLAN_CONFIGS } from '../../lib/constants';

interface SubscriptionEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: Subscription | null;
  plans: Plan[];
  onConfirm: (updated: Subscription) => void;
}

export const SubscriptionEditModal: React.FC<SubscriptionEditModalProps> = ({
  isOpen,
  onClose,
  subscription,
  plans,
  onConfirm,
}) => {
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'active' | 'expired' | 'canceled'>('active');
  const [durationDays, setDurationDays] = useState('30');
  const [customExpiresAt, setCustomExpiresAt] = useState('');

  useEffect(() => {
    if (subscription) {
      setSelectedPlanId(subscription.plan_id);
      setSelectedStatus(subscription.status);
      if (subscription.expires_at) {
        setCustomExpiresAt(subscription.expires_at.slice(0, 10)); // YYYY-MM-DD
      } else {
        setCustomExpiresAt('');
      }
    }
  }, [subscription, isOpen]);

  const handleQuickDuration = (days: number) => {
    const end = new Date();
    end.setDate(end.getDate() + days);
    setCustomExpiresAt(end.toISOString().slice(0, 10));
    setDurationDays(days.toString());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subscription) return;

    let finalExpires: string | null = null;
    if (customExpiresAt) {
      finalExpires = new Date(customExpiresAt).toISOString();
    }

    onConfirm({
      ...subscription,
      plan_id: selectedPlanId,
      status: selectedStatus,
      expires_at: finalExpires,
    });
  };

  return (
    <ModalWrapper
      id="sub-edit-modal"
      title="ویرایش اشتراک و محدودیت هوش مصنوعی"
      isOpen={isOpen}
      onClose={onClose}
    >
      <form id="edit-sub-form" onSubmit={handleSubmit} className="space-y-6">
        
        {/* User identification meta info */}
        <div id="sub-meta-display" className="p-3 bg-slate-950/40 rounded-xl border border-slate-805 text-xs text-slate-400 space-y-1">
          <p id="sub-user-title">نام کاربر: <span className="font-bold text-slate-200">{subscription?.profiles?.display_name || 'کاربر بدون نام'}</span></p>
          <p id="sub-user-email">ایمیل / شماره تماس: <span className="font-mono text-slate-300">{[subscription?.profiles?.email, subscription?.profiles?.phone].filter(Boolean).join(' • ') || 'بدون ایمیل / موبایل'}</span></p>
        </div>

        {/* Plan Type Grid Options */}
        <div id="plan-selection-grid" className="space-y-2">
          <label className="text-xs font-bold text-slate-300">انتخاب پلن اشتراکی هوش مصنوعی</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {plans.map((p) => {
              const isSelected = selectedPlanId === p.id;
              const config = PLAN_CONFIGS[p.id] || PLAN_CONFIGS['free'];
              const Icon = config.icon;
              return (
                <button
                  id={`plan-btn-option-${p.id}`}
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPlanId(p.id)}
                  className={`p-3.5 rounded-xl border font-bold text-center flex flex-col items-center justify-center space-y-1.5 transition-all text-xs cursor-pointer ${
                    isSelected
                      ? 'border-brand-500 bg-brand-500/10 text-white'
                      : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-705'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isSelected ? 'text-brand-400' : 'text-slate-500'}`} />
                  <span>{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Status Selection Row */}
        <div id="status-selection" className="space-y-2">
          <label className="text-xs font-bold text-slate-300">وضعیت فعلی اشتراک</label>
          <div className="flex items-center gap-2">
            {(['active', 'expired', 'canceled'] as const).map((currStatus) => {
              const isSelected = selectedStatus === currStatus;
              const labels = { active: 'فعال', expired: 'منقضی شده', canceled: 'لغو شده' };
              const colors = { 
                active: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5', 
                expired: 'border-rose-500/30 text-rose-400 bg-rose-500/5', 
                canceled: 'border-amber-500/30 text-amber-400 bg-amber-500/5' 
              };
              return (
                <button
                  id={`status-option-${currStatus}`}
                  key={currStatus}
                  type="button"
                  onClick={() => setSelectedStatus(currStatus)}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all text-center cursor-pointer ${
                    isSelected 
                      ? `${colors[currStatus]} border-opacity-100 ring-1 ring-offset-slate-900 ring-slate-800` 
                      : 'border-slate-800 text-slate-500 hover:text-slate-300 bg-slate-950/20'
                  }`}
                >
                  {labels[currStatus]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Auto validity extend panel */}
        <div id="expiry-selection" className="space-y-2">
          <label className="text-xs font-bold text-slate-300">مدت اعتبار / تمدید تاریخ انقضا</label>
          <div className="grid grid-cols-4 gap-2">
            {[30, 90, 180, 365].map((days) => (
              <button
                id={`duration-btn-${days}`}
                key={days}
                type="button"
                onClick={() => handleQuickDuration(days)}
                className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
              >
                {days} روزه
              </button>
            ))}
          </div>
          
          <div className="pt-2">
            <Input
              id="sub-custom-expires-at"
              label="یا تاریخ انقضای دستی (میلادی)"
              type="date"
              value={customExpiresAt}
              onChange={(e) => setCustomExpiresAt(e.target.value)}
              icon={<CalendarDays className="w-4 h-4 text-slate-500" />}
            />
          </div>
        </div>

        {/* Form Modal Actions */}
        <div id="modal-actions-box" className="flex items-center justify-end gap-3 pt-2">
          <Button id="cancel-sub-edit" type="button" variant="secondary" onClick={onClose}>
            انصراف
          </Button>
          <Button id="submit-sub-edit" type="submit" variant="primary">
            اعمال و بروزرسانی اشتراک
          </Button>
        </div>

      </form>
    </ModalWrapper>
  );
};
