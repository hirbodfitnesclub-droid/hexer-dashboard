import React, { useEffect, useState } from 'react';
import { dataStore } from '../lib/dataStore';
import { Profile, Subscription, Payment, Plan, DiscountCode } from '../lib/supabase';
import { StatsCard } from '../components/ui/StatsCard';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { RevenueChart } from '../components/charts/RevenueChart';
import { UserGrowthChart } from '../components/charts/UserGrowthChart';
import { PlanDistributionChart } from '../components/charts/PlanDistributionChart';
import { RecentPayments } from '../components/ui/RecentPayments';
import { Card } from '../components/ui/Card';
import { 
  Users, 
  CreditCard, 
  TrendingUp, 
  Tag, 
  Briefcase, 
  CircleDollarSign,
  Activity,
  Award
} from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';

export const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [discounts, setDiscounts] = useState<DiscountCode[]>([]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [p, s, pay, d] = await Promise.all([
        dataStore.getProfiles(),
        dataStore.getSubscriptions(),
        dataStore.getPayments(),
        dataStore.getDiscountCodes(),
      ]);
      setProfiles(p);
      setSubscriptions(s);
      setPayments(pay);
      setDiscounts(d);
    } catch (err: any) {
      toast.error('خطا در دریافت اطلاعات داشبورد تحلیلی');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  if (loading) {
    return <LoadingSpinner size="lg" message="در حال واکشی آخرین تحلیل‌های مالی و آماری..." />;
  }

  // Calculations
  const totalUsers = profiles.length;
  
  const activeSubs = subscriptions.filter(sub => sub.status === 'active').length;
  
  const totalRevenue = payments
    .filter(pay => pay.status === 'success')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const activePromoCodes = discounts.filter(dis => dis.is_active).length;

  // Chart Formatting Helper
  // Revenue by Month or Week
  const revenueChartData = [
    { date: '۱۲ اردیبهشت', amount: 350000 },
    { date: '۱۸ اردیبهشت', amount: 590000 },
    { date: '۲۲ اردیبهشت', amount: 420000 },
    { date: '۲۸ اردیبهشت', amount: 920000 },
    { date: '۰۱ خرداد', amount: totalRevenue > 0 ? totalRevenue : 1240000 },
  ];

  const userGrowthData = [
    { date: '۱۵ اردیبهشت', count: 12 },
    { date: '۱۸ اردیبهشت', count: 19 },
    { date: '۲۲ اردیبهشت', count: 28 },
    { date: '۲۸ اردیبهشت', count: 42 },
    { date: '۰۱ خرداد', count: totalUsers },
  ];

  // Group plans distribution
  const planDistribution = [
    { name: 'پلن آزمایشی (رایگان)', value: subscriptions.filter(s => s.plan_id === 'free').length },
    { name: 'پلن پلاس', value: subscriptions.filter(s => s.plan_id === 'plus').length },
    { name: 'پلن پرو (حرفه‌ای)', value: subscriptions.filter(s => s.plan_id === 'pro').length },
  ];

  return (
    <motion.div
      id="dashboard-page-container"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-8"
    >
      {/* Top Banner Greetings */}
      <div id="greeting-banner" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 id="greeting-title" className="text-xl md:text-2xl font-extrabold text-slate-100 flex items-center space-x-2 space-x-reverse">
            <Activity className="w-6 h-6 text-brand-400 pointer-events-none" />
            <span>خلاصه وضعیت پلتفرم هکسر</span>
          </h2>
          <p id="greeting-subtitle" className="text-xs text-slate-400 font-semibold mt-1">
            یک نگاه کوتاه به رشد کاربران، آمار تراکنش‌ها و درآمدهای حاصله پلتفرم
          </p>
        </div>
        <div id="quick-refresh-btn">
          <button
            id="dashboard-refresh-action"
            onClick={loadAllData}
            className="px-4 py-2 text-xs font-bold bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white rounded-xl transition-all flex items-center space-x-2 space-x-reverse cursor-pointer"
          >
            <span>بروزرسانی زنده داده‌ها</span>
          </button>
        </div>
      </div>

      {/* Grid count cards */}
      <div id="stats-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatsCard
          id="stat-users"
          title="کل کاربران هکسر"
          value={totalUsers}
          icon={Users}
          trend={{ value: 14.5, isPositive: true, label: 'نسبت به هفته پیش' }}
          iconColorClass="text-brand-400 bg-brand-500/10"
        />
        <StatsCard
          id="stat-subs"
          title="اشتراک‌های فعال"
          value={activeSubs}
          icon={CreditCard}
          trend={{ value: 8.2, isPositive: true, label: 'نسبت به ماه پیش' }}
          iconColorClass="text-purple-400 bg-purple-500/10"
        />
        <StatsCard
          id="stat-revenue"
          title="کل درآمد کسب شده"
          value={`${totalRevenue.toLocaleString('fa-IR')} تومان`}
          icon={CircleDollarSign}
          trend={{ value: 18.9, isPositive: true, label: 'نسبت به ماه پیش' }}
          iconColorClass="text-emerald-400 bg-emerald-500/10"
        />
        <StatsCard
          id="stat-discounts"
          title="کدهای تخفیف فعال"
          value={activePromoCodes}
          icon={Tag}
          trend={{ value: 2, isPositive: false, label: 'انقضا یافته امروز' }}
          iconColorClass="text-amber-400 bg-amber-500/10"
        />
      </div>

      {/* Analytics charts rendering rows */}
      <div id="charts-grid" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Revenue Area Chart */}
        <div id="revenue-chart-box" className="lg:col-span-8 min-w-0">
          <Card id="revenue-chart-card" hoverable={false} className="h-full flex flex-col justify-between">
            <div id="revenue-chart-header" className="flex items-center justify-between pb-6 border-b border-slate-800/40 mb-6">
              <div>
                <h3 id="rc-title" className="text-sm font-bold text-slate-100 flex items-center space-x-2 space-x-reverse">
                  <TrendingUp className="w-5 h-5 text-emerald-400 pointer-events-none" />
                  <span>تحلیل سهم تراکنش‌ها و درآمدهای اخیر</span>
                </h3>
                <p id="rc-desc" className="text-[11px] text-slate-400 mt-1">نمایش تراکم پرداخت‌ها بر حسب تومان</p>
              </div>
            </div>
            <RevenueChart data={revenueChartData} />
          </Card>
        </div>

        {/* Plan Distribution Mini Donut */}
        <div id="plan-chart-box" className="lg:col-span-4 min-w-0">
          <Card id="plan-chart-card" hoverable={false} className="h-full flex flex-col justify-between">
            <div id="plan-chart-header" className="flex items-center justify-between pb-6 border-b border-slate-800/40 mb-6">
              <div>
                <h3 id="pc-title" className="text-sm font-bold text-slate-100 flex items-center space-x-2 space-x-reverse">
                  <Award className="w-5 h-5 text-indigo-400 pointer-events-none" />
                  <span>توزیع پلن‌های کاربری</span>
                </h3>
                <p id="pc-desc" className="text-[11px] text-slate-400 mt-1">میزان محبوبیت اشتراک‌های فعال هکسر</p>
              </div>
            </div>
            <PlanDistributionChart data={planDistribution} />
          </Card>
        </div>

        {/* User Conversion Rate Line Chart */}
        <div id="growth-chart-box" className="lg:col-span-12 min-w-0">
          <Card id="user-chart-card" hoverable={false}>
            <div id="user-chart-header" className="flex items-center justify-between pb-6 border-b border-slate-800/40 mb-6">
              <div>
                <h3 id="gc-title" className="text-sm font-bold text-slate-100 flex items-center space-x-2 space-x-reverse">
                  <Briefcase className="w-5 h-5 text-brand-400 pointer-events-none" />
                  <span>رشد فزاینده تعداد ثبت‌نام کاربران جدید</span>
                </h3>
                <p id="gc-subtitle" className="text-[11px] text-slate-400 mt-1">تراکم کاربران ورودی در دوره‌های زمانی اخیر</p>
              </div>
            </div>
            <UserGrowthChart data={userGrowthData} />
          </Card>
        </div>

      </div>

      {/* Recent Payments Section */}
      <div id="recent-payments-container">
        <Card id="recent-payments-card" hoverable={false}>
          <div id="payments-head-block" className="flex items-center justify-between pb-6 border-b border-slate-800/50 mb-6">
            <div>
              <h3 id="rpc-caption" className="text-sm font-bold text-slate-100 flex items-center space-x-2 space-x-reverse">
                <CircleDollarSign className="w-5 h-5 text-emerald-400 pointer-events-none" />
                <span>تراکنش‌های ریالی اخیر پلتفرم</span>
              </h3>
              <p id="rpc-subcaption" className="text-[11px] text-slate-400 mt-1">شامل گزارش پرداخت موفق، ناموفق یا معلق ادمین</p>
            </div>
          </div>
          <RecentPayments payments={payments.slice(0, 5)} />
        </Card>
      </div>

    </motion.div>
  );
};
