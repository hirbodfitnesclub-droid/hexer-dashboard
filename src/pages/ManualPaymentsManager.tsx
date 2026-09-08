import React, { useState, useEffect, useMemo, useRef } from 'react';
import { dataStore } from '../lib/dataStore';
import { useAdminStore } from '../store/adminStore';
import { Payment, ManualPaymentStatus } from '../lib/supabase';
import { ReceiptViewerModal } from '../components/ui/ReceiptViewerModal';
import { RejectReasonModal } from '../components/ui/RejectReasonModal';
import { ApproveConfirmModal } from '../components/ui/ApproveConfirmModal';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorPanel } from '../components/ui/ErrorPanel';
import { Pagination } from '../components/ui/Pagination';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { UserAvatar } from '../components/ui/UserAvatar';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { exportToCsv } from '../lib/csv';
import { formatToman, formatFaDateTime } from '../lib/format';
import { 
  Eye, 
  Check, 
  X, 
  RefreshCw, 
  Inbox, 
  CreditCard,
  Settings,
  Search,
  Download
} from 'lucide-react';
import toast from 'react-hot-toast';

export const ManualPaymentsManager: React.FC = () => {
  const { setActiveTab } = useAdminStore();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusTab, setStatusTab] = useState<ManualPaymentStatus | 'all'>('pending_manual');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebouncedValue(searchQuery, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [actingId, setActingId] = useState<string | null>(null);
  const isFirstTabRun = useRef(true);
  
  // Modal states
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState<boolean>(false);
  const [isRejectOpen, setIsRejectOpen] = useState<boolean>(false);
  const [isApproveOpen, setIsApproveOpen] = useState<boolean>(false);

  const fetchPayments = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setIsRefreshing(true);
    else setIsLoading(true);
    setLoadError(null);
    
    try {
      const data = await dataStore.getManualPayments(statusTab);
      setPayments(data || []);
    } catch (err: any) {
      const msg = err.message || 'خطا در دریافت لیست پرداخت‌ها';
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Skip on mount: the mount effect below already fetches (avoids double request).
    if (isFirstTabRun.current) {
      isFirstTabRun.current = false;
      return;
    }
    setPage(1);
    fetchPayments(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusTab]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

  const handleOpenApproveModal = (payment: Payment) => {
    setSelectedPayment(payment);
    setIsApproveOpen(true);
  };

  const handleApproveConfirm = async () => {
    if (!selectedPayment || actingId) return;

    try {
      setActingId(selectedPayment.id);
      const success = await dataStore.approveManualPayment(selectedPayment.id);
      if (success) {
        // Remove from local state
        setPayments(prev => prev.filter(p => p.id !== selectedPayment.id));
        setIsApproveOpen(false);
        setSelectedPayment(null);
      }
    } catch (err) {
      console.error('Error approving payment:', err);
    } finally {
      setActingId(null);
    }
  };

  const handleOpenRejectModal = (payment: Payment) => {
    setSelectedPayment(payment);
    setIsRejectOpen(true);
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!selectedPayment || actingId) return;

    try {
      setActingId(selectedPayment.id);
      const success = await dataStore.rejectManualPayment(selectedPayment.id, reason);
      if (success) {
        setPayments(prev => prev.filter(p => p.id !== selectedPayment.id));
        setIsRejectOpen(false);
        setSelectedPayment(null);
      }
    } catch (err) {
      console.error('Error rejecting payment:', err);
    } finally {
      setActingId(null);
    }
  };

  const handleViewReceipt = (payment: Payment) => {
    setSelectedPayment(payment);
    setIsViewerOpen(true);
  };

  const filteredPayments = useMemo(() => {
    const q = debouncedQuery.toLowerCase().trim();
    if (!q) return payments;
    return payments.filter((pay) => {
      const p = pay.profiles;
      return (
        (p?.display_name || '').toLowerCase().includes(q) ||
        (p?.email || '').toLowerCase().includes(q) ||
        (p?.phone || '').toLowerCase().includes(q) ||
        (pay.user_id || '').toLowerCase().includes(q) ||
        String(pay.amount).includes(q.replace(/[٬,]/g, '')) ||
        (pay.id || '').toLowerCase().includes(q)
      );
    });
  }, [payments, debouncedQuery]);

  const totalPages = Math.max(Math.ceil(filteredPayments.length / pageSize), 1);
  const safePage = Math.min(page, totalPages);
  const pagedPayments = filteredPayments.slice((safePage - 1) * pageSize, safePage * pageSize);

  const statusBadge = (pay: Payment) => {
    if (pay.status === 'paid') return <Badge variant="success">تایید شده</Badge>;
    if (pay.status === 'failed') return <Badge variant="danger">رد شده</Badge>;
    return <Badge variant="warning">در انتظار بررسی</Badge>;
  };

  const handleExportCsv = () => {
    const statusFa: Record<string, string> = { pending_manual: 'در انتظار', paid: 'تایید شده', failed: 'رد شده' };
    exportToCsv(
      `manual-payments-${statusTab}-${new Date().toISOString().slice(0, 10)}`,
      ['کاربر', 'ایمیل/موبایل', 'مبلغ (تومان)', 'وضعیت', 'دلیل رد', 'تاریخ ثبت'],
      filteredPayments.map((pay) => [
        pay.profiles?.display_name || '',
        [pay.profiles?.email, pay.profiles?.phone].filter(Boolean).join(' • '),
        pay.amount / 10,
        statusFa[pay.status] || pay.status,
        pay.manual_decline_reason || '',
        formatFaDateTime(pay.created_at),
      ]),
    );
    toast.success('فایل CSV پرداخت‌ها دانلود شد.');
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
            id="goto-settings-btn"
            onClick={() => setActiveTab('settings')}
            className="flex items-center justify-center space-x-2 space-x-reverse px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-white/5 hover:border-white/10 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <Settings className="w-4 h-4 text-slate-300 transition-all" />
            <span>تنظیمات تلگرام و کارت مقصد</span>
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

      {/* Status tabs + search/export */}
      <div id="history-controls" className="bg-slate-900/60 backdrop-blur-md rounded-2xl p-4 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center overflow-x-auto gap-2 py-1">
          {([
            { id: 'pending_manual', label: 'در انتظار بررسی' },
            { id: 'paid', label: 'تایید شده‌ها' },
            { id: 'failed', label: 'رد شده‌ها' },
            { id: 'all', label: 'همه' },
          ] as const).map((t) => (
            <button
              key={t.id}
              id={`pay-tab-${t.id}`}
              onClick={() => setStatusTab(t.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusTab === t.id
                  ? 'bg-brand-500/10 border border-brand-500/30 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              id="pay-search-box"
              type="text"
              placeholder="جستجو کاربر، مبلغ، شناسه..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/50 border border-white/5 focus:border-brand-500/50 rounded-xl pr-10 pl-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
            />
          </div>
          <Button id="export-payments-btn" variant="secondary" size="sm" onClick={handleExportCsv} icon={<Download className="w-3.5 h-3.5" />}>
            CSV
          </Button>
        </div>
      </div>

      {/* Main content shelf */}
      {isLoading ? (
        <div id="manager-loading" className="flex flex-col items-center justify-center py-20 bg-slate-900/40 border border-white/5 rounded-2xl">
          <LoadingSpinner />
          <span className="text-xs text-slate-400 mt-4 font-semibold">در حال دریافت لیست پرداخت‌ها...</span>
        </div>
      ) : loadError ? (
        <ErrorPanel id="manager-error" message={loadError} onRetry={() => fetchPayments()} />
      ) : filteredPayments.length === 0 ? (
        <div id="manager-empty" className="flex flex-col items-center justify-center py-20 bg-slate-900/40 border border-white/5 rounded-2xl text-center">
          <div className="w-16 h-16 bg-slate-800/50 rounded-2xl flex items-center justify-center mb-4 border border-white/5 text-slate-500">
            <Inbox className="w-8 h-8" />
          </div>
          <h3 className="text-sm font-bold text-slate-200">
            {debouncedQuery ? 'موردی با این جستجو یافت نشد' : statusTab === 'pending_manual' ? 'صندوق تاییدات خالی است' : 'تاریخچه‌ای در این بخش وجود ندارد'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {debouncedQuery ? 'عبارت دیگری را امتحان کنید.' : statusTab === 'pending_manual' ? 'هیچ فیش رسید بانکی در انتظار تایید وجود ندارد.' : 'هنوز پرداختی با این وضعیت ثبت نشده است.'}
          </p>
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
                  <th className="px-6 py-4">وضعیت / نتیجه</th>
                  <th className="px-6 py-4">سند رسید</th>
                  <th className="px-6 py-4 text-left">عملیات بازرسی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {pagedPayments.map((pay) => {
                  const userProfile = pay.profiles;
                  const isPending = pay.status === 'pending_manual';
                  return (
                    <tr id={`payment-row-${pay.id}`} key={pay.id} className="hover:bg-white/[0.01] transition-all text-xs">
                      {/* User profile */}
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3 space-x-reverse">
                          <UserAvatar 
                            id={`user-avatar-${pay.id}`} 
                            avatarUrl={userProfile?.avatar_url} 
                            fallbackName={userProfile?.display_name || 'کاربر'} 
                          />
                          <div>
                            <h4 className="font-bold text-slate-200">{userProfile?.display_name || 'اسم نامشخص'}</h4>
                            <p className="text-[10px] text-slate-500 mt-0.5">{[userProfile?.email, userProfile?.phone].filter(Boolean).join(' • ') || pay.user_id}</p>
                          </div>
                        </div>
                      </td>

                      {/* Payment Amount */}
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm font-bold text-white bg-slate-950/50 px-2.5 py-1 rounded-lg border border-white/5">
                          {formatToman(pay.amount)}
                        </span>
                      </td>

                      {/* Submitted Date */}
                      <td className="px-6 py-4 text-slate-400 font-medium">
                        {formatFaDateTime(pay.created_at)}
                      </td>

                      {/* Status / result */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5 items-start">
                          {statusBadge(pay)}
                          {pay.status === 'failed' && pay.manual_decline_reason && (
                            <span className="text-[10px] text-slate-500 max-w-[220px] leading-relaxed" title={pay.manual_decline_reason}>
                              دلیل: {pay.manual_decline_reason.length > 60 ? pay.manual_decline_reason.slice(0, 60) + '…' : pay.manual_decline_reason}
                            </span>
                          )}
                          {pay.status === 'paid' && pay.paid_at && (
                            <span className="text-[10px] text-slate-500">{formatFaDateTime(pay.paid_at)}</span>
                          )}
                        </div>
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
                          <span className="text-slate-500 font-semibold bg-slate-800/50 px-2 py-1 rounded-md border border-white/5">
                            {isPending ? 'امضا منقضی یا بدون فیش' : '—'}
                          </span>
                        )}
                      </td>

                      {/* Approval and Rejection actions */}
                      <td className="px-6 py-4 text-left">
                        {isPending ? (
                        <div className="inline-flex items-center gap-2">
                          {/* Approve (Check) */}
                          <button
                            id={`approve-btn-${pay.id}`}
                            onClick={() => handleOpenApproveModal(pay)}
                            disabled={actingId === pay.id}
                            title="تایید و فعال‌سازی اشتراک"
                            className="p-2 bg-emerald-500/10 hover:bg-emerald-500 border border-emerald-500/20 hover:border-emerald-500 text-emerald-400 hover:text-white rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Check className="w-4 h-4" />
                          </button>

                          {/* Decline (Decline) */}
                          <button
                            id={`reject-btn-${pay.id}`}
                            onClick={() => handleOpenRejectModal(pay)}
                            disabled={actingId === pay.id}
                            title="رد رسید مالی"
                            className="p-2 bg-rose-500/10 hover:bg-rose-500 border border-rose-500/20 hover:border-rose-500 text-rose-400 hover:text-white rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        ) : (
                          <span className="text-[10px] text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-6 pb-5">
            <Pagination
              id="payments-pagination"
              page={safePage}
              totalPages={totalPages}
              totalItems={filteredPayments.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
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
