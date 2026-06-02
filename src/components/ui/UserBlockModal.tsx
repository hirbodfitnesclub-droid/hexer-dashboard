import React, { useState, useEffect } from 'react';
import { Profile } from '../../lib/supabase';
import { ModalWrapper } from './ModalWrapper';
import { Input } from './Input';
import { Button } from './Button';
import { ShieldAlert, ShieldCheck, User } from 'lucide-react';

interface UserBlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile | null;
  onConfirm: (updated: Profile) => void;
}

export const UserBlockModal: React.FC<UserBlockModalProps> = ({
  isOpen,
  onClose,
  profile,
  onConfirm,
}) => {
  const [displayName, setDisplayName] = useState('');
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setIsBlocked(!!profile.is_blocked);
    }
  }, [profile, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    onConfirm({
      ...profile,
      display_name: displayName,
      is_blocked: isBlocked,
    });
  };

  return (
    <ModalWrapper
      id="user-block-modal"
      title="ویرایش وضعیت و مشخصات کاربر"
      isOpen={isOpen}
      onClose={onClose}
    >
      <form id="edit-user-form" onSubmit={handleSubmit} className="space-y-6">
        <div id="quick-meta-user" className="p-3 bg-slate-950/40 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
          <p id="usr-uid">شناسه سیستمی: <span className="font-mono text-slate-300">#{profile?.id}</span></p>
          <p id="usr-uemail">پست الکترونیکی: <span className="font-mono text-slate-300">{profile?.email || 'مشخص نشده'}</span></p>
        </div>

        <Input
          id="block-display-name"
          label="نام و نام خانوادگی کاربر"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="مثال: امیر قاسم پور"
          icon={<User className="w-4 h-4 text-slate-500" />}
          required
        />

        {/* Toggle block control */}
        <div id="block-switch" className="flex items-center justify-between p-4 bg-slate-950/20 border border-slate-800/80 rounded-xl">
          <div>
            <span id="block-title" className="text-xs font-bold text-slate-200">محدودیت دسترسی (مسدودسازی)</span>
            <p id="block-sub" className="text-[10px] text-slate-500 mt-0.5 mt-px">جلوگیری موقت یا دائم کاربر از دسترسی به سرویس هوش مصنوعی هکسر</p>
          </div>
          <button
            id="toggle-block-button"
            type="button"
            onClick={() => setIsBlocked(!isBlocked)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              isBlocked 
                ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20' 
                : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
            }`}
          >
            {isBlocked ? (
              <>
                <ShieldAlert className="w-4 h-4 pointer-events-none" />
                <span>مسدود شده</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 pointer-events-none" />
                <span>دسترسی آزاد</span>
              </>
            )}
          </button>
        </div>

        <div id="modal-actions-pair" className="flex items-center justify-end gap-3 pt-2">
          <Button id="cancel-user-edit" type="button" variant="secondary" onClick={onClose}>
            انصراف
          </Button>
          <Button id="submit-user-edit" type="submit" variant="primary">
            ذخیره تغییرات
          </Button>
        </div>
      </form>
    </ModalWrapper>
  );
};
