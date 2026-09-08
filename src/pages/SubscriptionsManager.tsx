import React, { useEffect, useMemo, useState } from 'react';
import { Subscription, Plan, Profile } from '../lib/supabase';
import { dataStore } from '../lib/dataStore';
import { Card } from '../components/ui/Card';
import { SubscriptionRow } from '../components/ui/SubscriptionRow';
import { SubscriptionEditModal } from '../components/ui/SubscriptionEditModal';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorPanel } from '../components/ui/ErrorPanel';
import { Pagination } from '../components/ui/Pagination';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { ModalWrapper } from '../components/ui/ModalWrapper';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { CreditCard, Search, Plus, Download, UserPlus } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { PLAN_CONFIGS } from '../lib/constants';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { exportToCsv } from '../lib/csv';
import { formatFaDate } from '../lib/format';

export const SubscriptionsManager: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebouncedValue(searchQuery, 350);
  const [activePlanFilter, setActivePlanFilter] = useState<string>('all');
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Modal active variables
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Subscription | null>(null);
  const [isActing, setIsActing] = useState(false);

  // Create form state
  const [createUserQuery, setCreateUserQuery] = useState('');
  const [createUserId, setCreateUserId] = useState('');
  const [createPlan, setCreatePlan] = useState('');
  const [createExpires, setCreateExpires] = useState('');

  const loadSubscriptionGrid = async (soft = false) => {
    try {
      if (!soft) setLoading(true);
      setLoadError(null);
      const [subsList, plansList, profilesList] = await Promise.all([
        dataStore.getSubscriptions(),
        dataStore.getPlans(),
        dataStore.getProfiles(),
      ]);
      setSubscriptions(subsList);
      setPlans(plansList);
      setProfiles(profilesList);
      if (plansList.length > 0) setCreatePlan((prev) => prev || plansList[0].id);
    } catch (e: any) {
      const msg = e.message || 'خطا در بارگذاری اطلاعات اشتراک‌های کاربری';
      setLoadError(msg);
      if (!soft) toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscriptionGrid();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, activePlanFilter, activeStatusFilter]);

  const handleEditClick = (subscription: Subscription) => {
    setSelectedSubscription(subscription);
    setIsEditModalOpen(true);
  };

  const handleConfirmEdit = async (updated: Subscription) => {
    const success = await dataStore.saveSubscription(updated);
    if (success) {
      setIsEditModalOpen(false);
      setSelectedSubscription(null);
      // Reload to show updates
      loadSubscriptionGrid(true);
    } else {
      toast.error('خطا در بروزرسانی دستی اشتراک کاربر.');
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget || isActing) return;
    try {
      setIsActing(true);
      await dataStore.cancelSubscription(cancelTarget.user_id);
      setCancelTarget(null);
      await loadSubscriptionGrid(true);
    } catch {
      // toast handled in dataStore
    } finally {
      setIsActing(false);
    }
  };

  const handleConfirmCreate = async () => {
    if (!createUserId) {
      toast.error('ابتدا کاربر را انتخاب کنید.');
      return;
    }
    if (!createPlan) {
      toast.error('پلن را انتخاب کنید.');
      return;
    }
    if (isActing) return;
    try {
      setIsActing(true);
      await dataStore.createSubscription({
        user_id: createUserId,
        plan_code: createPlan,
        expires_at: createExpires ? new Date(createExpires).toISOString() : null,
      });
      setIsCreateOpen(false);
      setCreateUserId('');
      setCreateUserQuery('');
      setCreateExpires('');
      await loadSubscriptionGrid(true);
    } catch {
      // toast handled in dataStore
    } finally {
      setIsActing(false);
    }
  };

  const usersWithoutSub = useMemo(() => {
    const withSub = new Set(subscriptions.map((s) => s.user_id));
    return profiles.filter((p) => !withSub.has(p.id));
  }, [profiles, subscriptions]);

  const createCandidates = useMemo(() => {
    const q = createUserQuery.toLowerCase().trim();
    const list = q
      ? usersWithoutSub.filter(
          (p) =>
            (p.display_name || '').toLowerCase().includes(q) ||
            (p.email || '').toLowerCase().includes(q) ||
            (p.phone || '').toLowerCase().includes(q),
        )
      : usersWithoutSub;
    return list.slice(0, 8);
  }, [usersWithoutSub, createUserQuery]);

  const filteredSubscriptions = useMemo(() => {
    const q = debouncedQuery.toLowerCase().trim();
    return subscriptions.filter(sub => {
      const nameStr = (sub.profiles?.display_name || '').toLowerCase();
      const emailStr = ((sub.profiles as any)?.email || '').toLowerCase();
      const phoneStr = ((sub.profiles as any)?.phone || '').toLowerCase();
      const matchesSearch = !q ? true : (
        nameStr.includes(q) || emailStr.includes(q) || phoneStr.includes(q) ||
        (sub.id || '').toLowerCase().includes(q) || (sub.user_id || '').toLowerCase().includes(q)
      );

      // plan match tolerant to plan_code vs plan_id naming
      const code = (((sub as any).plan_code || sub.plan_id || '') as string).toLowerCase();
      const matchesPlan = activePlanFilter === 'all' || code === activePlanFilter.toLowerCase();
      const matchesStatus = activeStatusFilter === 'all' || sub.status === activeStatusFilter;

      return matchesSearch && matchesPlan && matchesStatus;
    });
  }, [subscriptions, debouncedQuery, activePlanFilter, activeStatusFilter]);

  const totalPages = Math.max(Math.ceil(filteredSubscriptions.length / pageSize), 1);
  const safePage = Math.min(page, totalPages);
  const pagedSubscriptions = filteredSubscriptions.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleExportCsv = () => {
    exportToCsv(
      `subscriptions-${new Date().toISOString().slice(0, 10)}`,
      ['کاربر', 'ایمیل/موبایل', 'پلن', 'وضعیت', 'انقضا'],
      filteredSubscriptions.map((s) => [
        s.profiles?.display_name || '',
        [(s.profiles as any)?.email, (s.profiles as any)?.phone].filter(Boolean).join(' • '),
        s.plans?.name || s.plan_id,
        s.status,
        s.expires_at ? formatFaDate(s.expires_at) : '',
      ]),
    );
    toast.success('فایل CSV اشتراک‌ها دانلود شد.');
  };

  return (
    <motion.div
      id="subscriptions-manager-container"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
    >
      {/* Upper Module Briefing */}
      <div id="sub-manager-heading" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 id="sub-manager-title" className="text-xl md:text-2xl font-extrabold text-slate-100 flex items-center space-x-2 space-x-reverse">
            <CreditCard className="w-6 h-6 text-brand-400 pointer-events-none" />
            <span>مدیریت بسته‌ها و عضویت اعضا</span>
          </h2>
          <p id="sub-manager-desc" className="text-xs text-slate-400 font-semibold mt-1">
            تمدید، لغو، تغییر میزان اعتبار هوش مصنوعی و ارتقاء حساب کاربران به سطح پرو یا انترپرایز
          </p>
        </div>

        {/* Counter Indicators + actions */}
        <div id="sub-manager-pills" className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5">
            <span className="text-slate-400">کل اشتراک‌ها:</span>
            <span className="font-mono text-brand-400 font-bold">{subscriptions.length}</span>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 text-emerald-400">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
            <span>{subscriptions.filter(s => s.status === 'active').length} فعال</span>
          </div>
          <Button id="sub-export-btn" variant="secondary" size="sm" onClick={handleExportCsv} icon={<Download className="w-3.5 h-3.5" />}>
            CSV
          </Button>
          <Button id="sub-create-btn" variant="primary" size="sm" onClick={() => setIsCreateOpen(true)} icon={<Plus className="w-4 h-4" />}>
            اشتراک جدید
          </Button>
        </div>
      </div>

      {/* Control Tools Bar */}
      <div id="sub-controls" className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        
        {/* Search Input bar query */}
        <div id="sub-search" className="lg:col-span-6">
          <Input
            id="sub-search-query-inp"
            type="text"
            placeholder="جستجو بر اساس نام کاربر، ایمیل/موبایل یا شناسه..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="w-4 h-4 text-slate-500" />}
          />
        </div>

        {/* Plan Filter dropdown options select */}
        <div id="sub-filters" className="lg:col-span-6 flex flex-wrap sm:flex-nowrap gap-2 items-center justify-end">
          
          {/* Plan Filter Selector */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-1 w-full sm:w-auto overflow-x-auto">
            <button
              id="plan-filter-all"
              onClick={() => setActivePlanFilter('all')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activePlanFilter === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              همه پلن‌ها
            </button>
            {Object.entries(PLAN_CONFIGS).map(([key, config]) => (
              <button
                id={`plan-filter-${key}`}
                key={key}
                onClick={() => setActivePlanFilter(key)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activePlanFilter === key
                    ? config.filterClass
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {config.name}
              </button>
            ))}
          </div>

          {/* Status Filter selector row */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-1 w-full sm:w-auto">
            <button
              id="status-filter-all"
              onClick={() => setActiveStatusFilter('all')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeStatusFilter === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              همه وضعیت‌ها
            </button>
            <button
              id="status-filter-active"
              onClick={() => setActiveStatusFilter('active')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeStatusFilter === 'active'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              فعال
            </button>
            <button
              id="status-filter-expired"
              onClick={() => setActiveStatusFilter('expired')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeStatusFilter === 'expired'
                  ? 'bg-rose-500/10 text-rose-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              منقضی شده
            </button>
            <button
              id="status-filter-canceled"
              onClick={() => setActiveStatusFilter('canceled')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeStatusFilter === 'canceled'
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              لغو شده
            </button>
          </div>

        </div>

      </div>

      {/* Main Subscriptions List card */}
      <Card id="subs-list-card" hoverable={false}>
        {loading ? (
          <LoadingSpinner size="md" message="بارگذاری بسته‌ها و عضویت‌های فعال اعضا..." />
        ) : loadError ? (
          <ErrorPanel id="subs-error-panel" message={loadError} onRetry={() => loadSubscriptionGrid()} />
        ) : (
          <div id="subs-table-scroll" className="overflow-x-auto w-full">
            <table id="subs-data-table" className="w-full text-right border-collapse">
              <thead>
                <tr id="sub-thead-row" className="border-b border-slate-800 text-slate-400 text-xs">
                  <th className="pb-3 text-right font-semibold pl-4">کاربر پلتفرم</th>
                  <th className="pb-3 text-right font-semibold">نوع پلن</th>
                  <th className="pb-3 text-right font-semibold">وضعیت سیستم</th>
                  <th className="pb-3 text-right font-semibold">هزینه پرداختی</th>
                  <th className="pb-3 text-right font-semibold">تاریخ انقضاء</th>
                  <th className="pb-3 text-left font-semibold pr-4">تمدید دستی / لغو</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {pagedSubscriptions.length === 0 ? (
                  <tr id="sub-empty-row-item">
                    <td colSpan={6} className="py-12 text-center text-slate-500 text-xs font-medium">
                      هیچ عضویت یا اشتراک هماهنگی یافت نگردید.
                    </td>
                  </tr>
                ) : (
                  pagedSubscriptions.map(sub => (
                    <SubscriptionRow
                      key={sub.id}
                      subscription={sub}
                      onEdit={handleEditClick}
                      onCancel={(s) => setCancelTarget(s)}
                    />
                  ))
                )}
              </tbody>
            </table>
            <Pagination
              id="subs-pagination"
              page={safePage}
              totalPages={totalPages}
              totalItems={filteredSubscriptions.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          </div>
        )}
      </Card>

      {/* Subscription edit/upgrade interactive modal */}
      <SubscriptionEditModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedSubscription(null);
        }}
        subscription={selectedSubscription}
        plans={plans}
        onConfirm={handleConfirmEdit}
      />

      {/* Cancel confirmation */}
      <ConfirmModal
        id="sub-cancel-modal"
        isOpen={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleConfirmCancel}
        title="لغو اشتراک کاربر"
        message={`اشتراک «${cancelTarget?.profiles?.display_name || 'کاربر'}» لغو شود؟ کاربر تا پایان دوره به سرویس دسترسی نخواهد داشت.`}
        confirmLabel="لغو اشتراک"
        variant="danger"
        isLoading={isActing}
      />

      {/* Create subscription for existing user */}
      <ModalWrapper
        id="sub-create-modal"
        isOpen={isCreateOpen}
        onClose={() => { setIsCreateOpen(false); setCreateUserId(''); setCreateUserQuery(''); setCreateExpires(''); }}
        title="ساخت اشتراک جدید"
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-brand-400" />
              انتخاب کاربر (فقط کاربران بدون اشتراک)
            </label>
            <Input
              id="create-user-search"
              type="text"
              placeholder="جستجو نام، ایمیل یا موبایل..."
              value={createUserId ? (profiles.find((p) => p.id === createUserId)?.display_name || '') : createUserQuery}
              onChange={(e) => { setCreateUserId(''); setCreateUserQuery(e.target.value); }}
              icon={<Search className="w-4 h-4 text-slate-500" />}
            />
            {!createUserId && createCandidates.length > 0 && (
              <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-800 divide-y divide-slate-800/60">
                {createCandidates.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setCreateUserId(p.id)}
                    className="w-full text-right px-3 py-2 hover:bg-slate-800/60 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="text-xs font-bold text-slate-200 truncate">{p.display_name || 'بدون نام'}</span>
                    <span className="text-[10px] text-slate-500 font-mono truncate">{p.email || p.phone || ''}</span>
                  </button>
                ))}
              </div>
            )}
            {!createUserId && createUserQuery.trim() && createCandidates.length === 0 && (
              <p className="text-[11px] text-slate-500">کاربر بدون اشتراکی با این مشخصات یافت نشد.</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300">پلن اشتراک</label>
            <div className="grid grid-cols-3 gap-2">
              {plans.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setCreatePlan(p.id)}
                  className={`py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    createPlan === p.id
                      ? 'border-brand-500 bg-brand-500/10 text-white'
                      : 'border-slate-800 text-slate-400 hover:border-slate-700 bg-slate-950/40'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <Input
            id="create-expires-at"
            label="تاریخ انقضا (خالی = طبق دوره پلن)"
            type="date"
            value={createExpires}
            onChange={(e) => setCreateExpires(e.target.value)}
          />

          <div className="flex items-center justify-end gap-3">
            <Button id="create-sub-cancel" variant="secondary" size="sm" onClick={() => setIsCreateOpen(false)}>
              انصراف
            </Button>
            <Button id="create-sub-submit" variant="primary" size="sm" onClick={handleConfirmCreate} isLoading={isActing} icon={<Plus className="w-4 h-4" />}>
              ساخت اشتراک
            </Button>
          </div>
        </div>
      </ModalWrapper>

    </motion.div>
  );
};
