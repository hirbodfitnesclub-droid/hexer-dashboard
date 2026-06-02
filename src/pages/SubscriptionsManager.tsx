import React, { useEffect, useState } from 'react';
import { Subscription, Plan } from '../lib/supabase';
import { dataStore } from '../lib/dataStore';
import { Card } from '../components/ui/Card';
import { SubscriptionRow } from '../components/ui/SubscriptionRow';
import { SubscriptionEditModal } from '../components/ui/SubscriptionEditModal';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Input } from '../components/ui/Input';
import { CreditCard, Search, ShieldCheck, TicketCheck } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';

export const SubscriptionsManager: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activePlanFilter, setActivePlanFilter] = useState<string>('all');
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>('all');

  // Modal active variables
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const loadSubscriptionGrid = async () => {
    try {
      setLoading(true);
      const [subsList, plansList] = await Promise.all([
        dataStore.getSubscriptions(),
        dataStore.getPlans(),
      ]);
      setSubscriptions(subsList);
      setPlans(plansList);
    } catch (e: any) {
      toast.error('خطا در بارگذاری اطلاعات اشتراک‌های کاربری');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscriptionGrid();
  }, []);

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
      loadSubscriptionGrid();
    } else {
      toast.error('خطا در بروزرسانی دستی اشتراک کاربر.');
    }
  };

  const filteredSubscriptions = subscriptions.filter(sub => {
    const nameStr = (sub.profiles?.display_name || '').toLowerCase();
    const emailStr = (sub.profiles?.email || '').toLowerCase();
    const matchesSearch = nameStr.includes(searchQuery.toLowerCase()) || emailStr.includes(searchQuery.toLowerCase()) || sub.id.includes(searchQuery);

    const matchesPlan = activePlanFilter === 'all' || sub.plan_id === activePlanFilter;
    const matchesStatus = activeStatusFilter === 'all' || sub.status === activeStatusFilter;

    return matchesSearch && matchesPlan && matchesStatus;
  });

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

        {/* Counter Indicators */}
        <div id="sub-manager-pills" className="flex items-center gap-3">
          <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5">
            <span className="text-slate-400">کل اشتراک‌ها:</span>
            <span className="font-mono text-brand-400 font-bold">{subscriptions.length}</span>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 text-emerald-400">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
            <span>{subscriptions.filter(s => s.status === 'active').length} فعال</span>
          </div>
        </div>
      </div>

      {/* Control Tools Bar */}
      <div id="sub-controls" className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        
        {/* Search Input bar query */}
        <div id="sub-search" className="lg:col-span-6">
          <Input
            id="sub-search-query-inp"
            type="text"
            placeholder="جستجو بر اساس نام کاربر، ایمیل یا شناسه اشتراک..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="w-4 h-4 text-slate-500" />}
          />
        </div>

        {/* Plan Filter dropdown options select */}
        <div id="sub-filters" className="lg:col-span-6 flex flex-wrap sm:flex-nowrap gap-2 items-center justify-end">
          
          {/* Plan Filter Selector */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-1 w-full sm:w-auto">
            <button
              id="plan-filter-all"
              onClick={() => setActivePlanFilter('all')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activePlanFilter === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              همه پلن‌ها
            </button>
            <button
              id="plan-filter-free"
              onClick={() => setActivePlanFilter('free')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activePlanFilter === 'free'
                  ? 'bg-slate-500/10 text-slate-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              رایگان
            </button>
            <button
              id="plan-filter-plus"
              onClick={() => setActivePlanFilter('plus')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activePlanFilter === 'plus'
                  ? 'bg-purple-500/10 text-purple-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              پلاس
            </button>
            <button
              id="plan-filter-pro"
              onClick={() => setActivePlanFilter('pro')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activePlanFilter === 'pro'
                  ? 'bg-[#4a6bf2]/10 text-[#4a6bf2]'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              پرو
            </button>
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
          </div>

        </div>

      </div>

      {/* Main Subscriptions List card */}
      <Card id="subs-list-card" hoverable={false}>
        {loading ? (
          <LoadingSpinner size="md" message="بارگذاری بسته‌ها و عضویت‌های فعال اعضا..." />
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
                  <th className="pb-3 text-left font-semibold pr-4">تمدید دستی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filteredSubscriptions.length === 0 ? (
                  <tr id="sub-empty-row-item">
                    <td colSpan={6} className="py-12 text-center text-slate-500 text-xs font-medium">
                      هیچ عضویت یا اشتراک هماهنگی یافت نگردید.
                    </td>
                  </tr>
                ) : (
                  filteredSubscriptions.map(sub => (
                    <SubscriptionRow
                      key={sub.id}
                      subscription={sub}
                      onEdit={handleEditClick}
                    />
                  ))
                )}
              </tbody>
            </table>
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

    </motion.div>
  );
};
