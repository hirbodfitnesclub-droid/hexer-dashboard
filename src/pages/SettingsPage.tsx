import React, { useEffect, useState } from 'react';
import { dataStore } from '../lib/dataStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Settings as SettingsIcon, Bell, CreditCard, Send } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';

/**
 * صفحه تنظیمات پنل: اعلان تلگرام + شماره کارت مقصد کارت‌به‌کارت.
 * (قبلاً تنظیمات تلگرام داخل صفحه پرداخت دستی دفن شده بود.)
 */
export const SettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);

  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSavingTg, setIsSavingTg] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const [cardNumber, setCardNumber] = useState('');
  const [cardOwner, setCardOwner] = useState('');
  const [isSavingCard, setIsSavingCard] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [tg, app] = await Promise.all([
          dataStore.getTelegramSettings(),
          dataStore.getAppSettings(),
        ]);
        if (tg) {
          setBotToken(tg.bot_token || '');
          setChatId(tg.chat_id || '');
          setIsEnabled(!!tg.is_enabled);
        }
        if (app) {
          setCardNumber(app.destination_card_number || '');
          setCardOwner(app.destination_card_owner || '');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSaveTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingTg) return;
    setIsSavingTg(true);
    try {
      await dataStore.saveTelegramSettings({ bot_token: botToken.trim(), chat_id: chatId.trim(), is_enabled: isEnabled });
    } finally {
      setIsSavingTg(false);
    }
  };

  const handleTest = async () => {
    if (isTesting) return;
    setIsTesting(true);
    try {
      await dataStore.testTelegram();
    } catch {
      // toast handled in dataStore
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = cardNumber.replace(/[\s-]/g, '');
    if (digits !== '' && !/^\d{16}$/.test(digits)) {
      toast.error('شماره کارت باید ۱۶ رقم باشد.');
      return;
    }
    if (isSavingCard) return;
    setIsSavingCard(true);
    try {
      await dataStore.saveAppSettings({ destination_card_number: digits, destination_card_owner: cardOwner.trim() });
    } finally {
      setIsSavingCard(false);
    }
  };

  if (loading) {
    return <LoadingSpinner size="md" message="در حال بارگذاری تنظیمات..." />;
  }

  return (
    <motion.div
      id="settings-page"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-xl md:text-2xl font-extrabold text-slate-100 flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-brand-400" />
          <span>تنظیمات پنل</span>
        </h2>
        <p className="text-xs text-slate-400 font-semibold mt-1">
          اعلان‌های تلگرام و اطلاعات حساب مقصد برای پرداخت کارت‌به‌کارت
        </p>
      </div>

      {/* Telegram */}
      <Card id="settings-telegram-card" hoverable={false}>
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
          <Bell className="w-5 h-5 text-brand-400" />
          ربات اطلاع‌رسانی تلگرام
        </h3>
        <p className="text-[11px] text-slate-400 mb-4">
          بعد از ثبت درخواست کارت‌به‌کارت جدید یا تیکت تازه، از ربات پیام دریافت می‌کنید.
        </p>
        <form onSubmit={handleSaveTelegram} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">توکن ربات (Bot Token)</label>
            <input
              type="password"
              autoComplete="off"
              placeholder="123456789:ABCdef..."
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500 transition-all font-mono"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">شناسه چت ادمین (Chat ID)</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="987654321"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500 transition-all font-mono"
              dir="ltr"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="w-4 h-4 accent-emerald-500"
            />
            اعلان تلگرام فعال باشد
          </label>
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button id="tg-test-btn" variant="secondary" size="sm" onClick={handleTest} isLoading={isTesting} icon={<Send className="w-3.5 h-3.5" />}>
              ارسال پیام آزمایشی
            </Button>
            <Button id="tg-save-btn" type="submit" variant="primary" size="sm" isLoading={isSavingTg}>
              ذخیره تنظیمات تلگرام
            </Button>
          </div>
        </form>
      </Card>

      {/* Destination card */}
      <Card id="settings-card-card" hoverable={false}>
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
          <CreditCard className="w-5 h-5 text-brand-400" />
          کارت مقصد کارت‌به‌کارت
        </h3>
        <p className="text-[11px] text-slate-400 mb-4">
          کاربران برای پرداخت آفلاین به این کارت واریز می‌کنند. خالی گذاشتن یعنی «تنظیم نشده».
        </p>
        <form onSubmit={handleSaveCard} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">شماره کارت (۱۶ رقم)</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="6037 •••• •••• ••••"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value.replace(/[^\d\s-]/g, '').slice(0, 23))}
              className="w-full px-4 py-2.5 bg-slate-950 border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500 transition-all font-mono tracking-widest"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">به‌نام</label>
            <input
              type="text"
              placeholder="نام صاحب حساب"
              value={cardOwner}
              onChange={(e) => setCardOwner(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500 transition-all"
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button id="card-save-btn" type="submit" variant="primary" size="sm" isLoading={isSavingCard}>
              ذخیره کارت مقصد
            </Button>
          </div>
        </form>
      </Card>
    </motion.div>
  );
};
