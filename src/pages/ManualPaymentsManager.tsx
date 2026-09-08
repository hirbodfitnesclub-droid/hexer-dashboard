import React, { useState, useEffect } from 'react';
import { dataStore } from '../lib/dataStore';
import { Payment } from '../lib/supabase';
import { ReceiptViewerModal } from '../components/ui/ReceiptViewerModal';
import { RejectReasonModal } from '../components/ui/RejectReasonModal';
import { ApproveConfirmModal } from '../components/ui/ApproveConfirmModal';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { UserAvatar } from '../components/ui/UserAvatar';
import { 
  Eye, 
  Check, 
  X, 
  RefreshCw, 
  FileCheck, 
  Inbox, 
  User,
  CreditCard,
  Settings,
  Bell
} from 'lucide-react';

export const ManualPaymentsManager: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  
  // Modal states
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState<boolean>(false);
  const [isRejectOpen, setIsRejectOpen] = useState<boolean>(false);
  const [isApproveOpen, setIsApproveOpen] = useState<boolean>(false);

  // Telegram Settings state
  const [showTelegramSettings, setShowTelegramSettings] = useState<boolean>(false);
  const [telegramBotToken, setTelegramBotToken] = useState<string>('');
  const [telegramChatId, setTelegramChatId] = useState<string>('');
  const [isTelegramEnabled, setIsTelegramEnabled] = useState<boolean>(false);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);

  const fetchPayments = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setIsRefreshing(true);
    else setIsLoading(true);
    
    try {
      const data = await dataStore.getManualPayments();
      setPayments(data || []);
    } catch (err) {
      console.error('Error fetching manual payments:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchTelegramSettings = async () => {
    try {
      const settings = await dataStore.getTelegramSettings();
      if (settings) {
        setTelegramBotToken(settings.bot_token || '');
        setTelegramChatId(settings.chat_id || '');
        setIsTelegramEnabled(!!settings.is_enabled);
      }
    } catch (err) {
      console.error('Error fetching telegram settings:', err);
    }
  };

  useEffect(() => {
    fetchPayments();
    fetchTelegramSettings();
  }, []);

  const handleSaveTelegramSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await dataStore.saveTelegramSettings({
        bot_token: telegramBotToken,
        chat_id: telegramChatId,
        is_enabled: isTelegramEnabled
      });
    } catch (err) {
      console.error('Error saving telegram settings:', err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleOpenApproveModal = (payment: Payment) => {
    setSelectedPayment(payment);
    setIsApproveOpen(true);
  };

  const handleApproveConfirm = async () => {
    if (!selectedPayment) return;

    try {
      const success = await dataStore.approveManualPayment(selectedPayment.id);
      if (success) {
        // Remove from local state
        setPayments(prev => prev.filter(p => p.id !== selectedPayment.id));
        setIsApproveOpen(false);
        setSelectedPayment(null);
      }
    } catch (err) {
      console.error('Error approving payment:', err);
    }
  };

  const handleOpenRejectModal = (payment: Payment) => {
    setSelectedPayment(payment);
    setIsRejectOpen(true);
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!selectedPayment) return;

    try {
      const success = await dataStore.rejectManualPayment(selectedPayment.id, reason);
      if (success) {
        setPayments(prev => prev.filter(p => p.id !== selectedPayment.id));
        setIsRejectOpen(false);
        setSelectedPayment(null);
      }
    } catch (err) {
      console.error('Error rejecting payment:', err);
    }
  };

  const handleViewReceipt = (payment: Payment) => {
    setSelectedPayment(payment);
    setIsViewerOpen(true);
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('fa-IR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div id="manual-payments-manager-root" className="space-y-6 text-slate-100 font-sans" dir="rtl">
      
      {/* Header Banner */}
      <div id="manager-header" className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 bg-slate-900 border border-white/5 rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-brand-500/5 blur-[80px] rounded-full pointer-events-none" />
        <div>
          <h2 id="manager-title" className="text-xl font-bold text-white flex items-center space-x-3 space-x-reverse">
            <CreditCard className="w-6 h-6 text-brand-400" />
            <span>تاییدات پرداخت‌های آفلاین (کارت به کارت)</span>
          </h2>
          <p id="manager-desc" className="text-xs text-slate-400 mt-1 font-medium select-none">
            لیست فیش‌های رسید بانکی ارسالی توسط کاربران جهت بررسی، اصالت‌سنجی و تایید اشتراک
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="toggle-telegram-settings-btn"
            onClick={() => setShowTelegramSettings(!showTelegramSettings)}
            className="flex items-center justify-center space-x-2 space-x-reverse px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-white/5 hover:border-white/10 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <Settings className={`w-4 h-4 ${showTelegramSettings ? 'text-brand-400 rotate-45' : 'text-slate-300'} transition-all`} />
            <span>تنظیمات هوشمند تلگرام</span>
          </button>

          <button
            id="refresh-payments-btn"
            onClick={() => fetchPayments(true)}
            disabled={isLoading || isRefreshing}
            className="flex items-center justify-center space-x-2 space-x-reverse px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-white/5 hover:border-white/10 rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-slate-300 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>به‌روزرسانی لیست</span>
          </button>
        </div>
      </div>

      {showTelegramSettings && (
        <div id="telegram-settings-card" className="p-6 bg-slate-900 border border-white/5 rounded-2xl relative overflow-hidden transition-all duration-300">
          <div className="absolute top-0 left-0 w-[150px] h-[150px] bg-brand-500/5 blur-[80px] rounded-full pointer-events-none" />
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2 space-x-reverse">
                  <Bell className="w-5 h-5 text-brand-400" />
                  <span>تنظیمات ربات اطلاع‌رسانی تلگرام</span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-1 font-medium select-none">
                  با تنظیم توکن ربات تلگرامی و شناسه چت کاربری خود، بلافاصله پس از ثبت درخواست کارت‌به‌کارت جدید توسط کاربران، از ربات در تلگرام خود پیام دریافت کنید.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none self-start sm:self-center">
                <input
                  type="checkbox"
                  checked={isTelegramEnabled}
                  onChange={(e) => setIsTelegramEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500 peer-checked:after:bg-white border border-white/5" />
                <span className="ms-3 text-xs font-medium text-slate-300">فعال بودن سیستم اعلان تلگرام</span>
              </label>
            </div>

            <form onSubmit={handleSaveTelegramSettings} className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">توکن ربات تلگرام (Bot Token)</label>
                <input
                  type="text"
                  placeholder="مثال: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                  value={telegramBotToken}
                  onChange={(e) => setTelegramBotToken(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500 transition-all font-mono"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">شناسه چت مدیر چنل یا چت ادمین (Chat ID)</label>
                <input
                  type="text"
                  placeholder="مثال: 987654321"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500 transition-all font-mono"
                  dir="ltr"
                />
              </div>

              <div className="md:col-span-2 flex justify-end mt-2">
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="px-5 py-2.5 bg-brand-500 hover:bg-brand-400 disabled:bg-brand-600/50 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 space-x-reverse disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSavingSettings ? (
                    <>
                      <LoadingSpinner />
                      <span>در حال ذخیره‌سازی...</span>
                    </>
                  ) : (
                    <>
                      <span>ذخیره تنظیمات تلگرام</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main content shelf */}
      {isLoading ? (
        <div id="manager-loading" className="flex flex-col items-center justify-center py-20 bg-slate-900/40 border border-white/5 rounded-2xl">
          <LoadingSpinner />
          <span className="text-xs text-slate-400 mt-4 font-semibold">در حال دریافت فیش‌های در انتظار بازرسی...</span>
        </div>
      ) : payments.length === 0 ? (
        <div id="manager-empty" className="flex flex-col items-center justify-center py-20 bg-slate-900/40 border border-white/5 rounded-2xl text-center">
          <div className="w-16 h-16 bg-slate-800/50 rounded-2xl flex items-center justify-center mb-4 border border-white/5 text-slate-500">
            <Inbox className="w-8 h-8" />
          </div>
          <h3 className="text-sm font-bold text-slate-200">صندوق تاییدات خالی است</h3>
          <p className="text-xs text-slate-500 mt-1 font-medium">هیچ فیش رسید بانکی در انتظار تایید وجود ندارد.</p>
        </div>
      ) : (
        <div id="manager-table-wrapper" className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-slate-950/20 text-slate-400 text-xs font-semibold">
                  <th className="px-6 py-4">کاربر</th>
                  <th className="px-6 py-4">مبلغ پرداختی</th>
                  <th className="px-6 py-4">تاریخ ارسال رسید</th>
                  <th className="px-6 py-4">سند رسید</th>
                  <th className="px-6 py-4 text-left">عملیات بازرسی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {payments.map((pay) => {
                  const userProfile = pay.profiles;
                  return (
                    <tr id={`payment-row-${pay.id}`} key={pay.id} className="hover:bg-white/[0.01] transition-all text-xs">
                      {/* User profile */}
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3 space-x-reverse">
                          <UserAvatar 
                            id={`user-avatar-${pay.id}`} 
                            avatarUrl={userProfile?.avatar_url} 
                            fallbackName={userProfile?.display_name || userProfile?.phone || 'کاربر'} 
                          />
                          <div>
                            <h4 className="font-bold text-slate-200">{userProfile?.display_name || userProfile?.phone || userProfile?.email || 'اسم نامشخص'}</h4>
                            <p className="text-[10px] text-slate-500 mt-0.5">{[userProfile?.email, userProfile?.phone].filter(Boolean).join(' • ') || pay.user_id}</p>
                          </div>
                        </div>
                      </td>

                      {/* Payment Amount */}
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm font-bold text-white bg-slate-950/50 px-2.5 py-1 rounded-lg border border-white/5">
                          {(pay.amount / 10).toLocaleString('fa-IR')} <span className="text-[10px] text-slate-400 font-sans">تومان</span>
                        </span>
                      </td>

                      {/* Submitted Date */}
                      <td className="px-6 py-4 text-slate-400 font-medium">
                        {formatDate(pay.created_at)}
                      </td>

                      {/* Receipt Doc action */}
                      <td className="px-6 py-4">
                        {pay.receipt_signed_url ? (
                          <button
                            id={`view-receipt-btn-${pay.id}`}
                            onClick={() => handleViewReceipt(pay)}
                            className="inline-flex items-center space-x-1.5 space-x-reverse text-brand-400 hover:text-brand-300 font-bold hover:underline transition-all cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                            <span>مشاهده فیش رسید</span>
                          </button>
                        ) : (
                          <span className="text-rose-400 font-semibold bg-rose-500/5 px-2 py-1 rounded-md border border-rose-500/10">امضا منقضی یا بدون فیش</span>
                        )}
                      </td>

                      {/* Approval and Rejection actions */}
                      <td className="px-6 py-4 text-left">
                        <div className="inline-flex items-center gap-2">
                          {/* Approve (Check) */}
                          <button
                            id={`approve-btn-${pay.id}`}
                            onClick={() => handleOpenApproveModal(pay)}
                            title="تایید و فعال‌سازی اشتراک"
                            className="p-2 bg-emerald-500/10 hover:bg-emerald-500 border border-emerald-500/20 hover:border-emerald-500 text-emerald-400 hover:text-white rounded-xl transition-all cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                          </button>

                          {/* Decline (Decline) */}
                          <button
                            id={`reject-btn-${pay.id}`}
                            onClick={() => handleOpenRejectModal(pay)}
                            title="رد رسید مالی"
                            className="p-2 bg-rose-500/10 hover:bg-rose-500 border border-rose-500/20 hover:border-rose-500 text-rose-400 hover:text-white rounded-xl transition-all cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals scope */}
      <ReceiptViewerModal 
        isOpen={isViewerOpen}
        onClose={() => {
          setIsViewerOpen(false);
          setSelectedPayment(null);
        }}
        imageUrl={selectedPayment?.receipt_signed_url || null}
        amount={selectedPayment?.amount || 0}
      />

      <RejectReasonModal 
        isOpen={isRejectOpen}
        onClose={() => {
          setIsRejectOpen(false);
          setSelectedPayment(null);
        }}
        onConfirm={handleRejectConfirm}
      />

      <ApproveConfirmModal 
        isOpen={isApproveOpen}
        onClose={() => {
          setIsApproveOpen(false);
          setSelectedPayment(null);
        }}
        onConfirm={handleApproveConfirm}
        amount={selectedPayment?.amount}
        userName={selectedPayment?.profiles?.display_name || undefined}
      />
    </div>
  );
};
