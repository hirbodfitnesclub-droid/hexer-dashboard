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
import { PLAN_CONFIGS } from '../lib/constants';
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
import { formatToman, faDayKey, faDayLabel } from '../lib/format';
import { ErrorPanel } from '../components/ui/ErrorPanel';

export const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [discounts, setDiscounts] = useState<DiscountCode[]>([]);

  const loadAllData = async (soft = false) => {
    try {
      if (soft) setIsRefreshing(true);
      else setLoading(true);
      setLoadError(null);
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
      const msg = err.message || 'خطا در دریافت اطلاعات داشبورد تحلیلی';
      setLoadError(msg);
      if (!soft) toast.error(msg);
      else toast.error(msg);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <LoadingSpinner size="lg" message="در حال واکشی آخرین تحلیل‌های مالی و آماری..." />;
  }

  if (loadError && profiles.length === 0 && payments.length === 0) {
    return <ErrorPanel id="dashboard-error-panel" message={loadError} onRetry={() => loadAllData()} />;
  }

  // Calculations
  const totalUsers = profiles.length;
  
  const activeSubs = subscriptions.filter(sub => sub.status === 'active').length;
  
  const totalRevenue = payments
    .filter(pay => pay.status === 'success')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const activePromoCodes = discounts.filter(dis => dis.is_active).length;

  // Revenue grouped by calendar day (key includes year + Tehran TZ so
  // same month/day of different years never merge into one bucket)
  const successPayments = [...payments]
    .filter(pay => pay.status === 'success')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const revenueByDay = new Map<string, { label: string; amount: number; time: number }>();
  successPayments.forEach(pay => {
    const key = faDayKey(pay.created_at);
    const prev = revenueByDay.get(key);
    revenueByDay.set(key, {
      label: faDayLabel(pay.created_at),
      amount: (prev?.amount || 0) + pay.amount,
      time: new Date(pay.created_at).getTime(),
    });
  });

  const revenueChartData = revenueByDay.size > 0 
    ? Array.from(revenueByDay.values())
        .sort((a, b) => a.time - b.time)
        .map(({ label, amount }) => ({ date: label, amount: amount / 10 }))
    : [{ date: 'امروز', amount: 0 }];

  // Cumulative User Growth grouped by signup day (year-aware key)
  const sortedProfiles = [...profiles]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const userByDay = new Map<string, { label: string; count: number; time: number }>();
  let userCumulativeCount = 0;
  sortedProfiles.forEach(prof => {
    userCumulativeCount += 1;
    const key = faDayKey(prof.created_at);
    userByDay.set(key, {
      label: faDayLabel(prof.created_at),
      count: userCumulativeCount,
      time: new Date(prof.created_at).getTime(),
    });
  });

  const userGrowthData = userByDay.size > 0
    ? Array.from(userByDay.values())
        .sort((a, b) => a.time - b.time)
        .map(({ label, count }) => ({ date: label, count }))
    : [{ date: 'امروز', count: 0 }];

  // Plan distribution over ACTIVE subscriptions only (matches the subtitle)
  const activeSubscriptions = subscriptions.filter(s => s.status === 'active');
  const planDistribution = Object.entries(PLAN_CONFIGS).map(([key, config]) => {
    return {
      name: key === 'free' ? 'پلن آزمایشی (رایگان)' : `پلن ${config.name}`,
      value: activeSubscriptions.filter(s => {
        const code = ((s as any).plan_code || s.plan_id || '').toLowerCase();
        if (key === 'free') {
          return code === 'free' || code === 'free-trial';
        }
        return code === key;
      }).length
    };
  });

  // Calculate real trends comparing past 7 days vs 7 days prior
  const now = new Date();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

  const calculateTrendForCount = (items: { created_at: string }[]) => {
    const nowTime = now.getTime();
    
    const last7Days = items.filter(item => {
      const itemTime = new Date(item.created_at).getTime();
      return itemTime >= nowTime - SEVEN_DAYS_MS && itemTime <= nowTime;
    }).length;

    const prev7Days = items.filter(item => {
      const itemTime = new Date(item.created_at).getTime();
      return itemTime >= nowTime - 2 * SEVEN_DAYS_MS && itemTime < nowTime - SEVEN_DAYS_MS;
    }).length;

    if (prev7Days === 0) {
      // Honest edge cases: never fabricate a +100% trend.
      if (last7Days === 0) {
        return { value: 0, isPositive: true, label: 'بدون تغییر' };
      }
      return { value: 0, isPositive: true, label: 'داده جدید', valueText: 'جدید' };
    }

    const percentageChange = Math.round(((last7Days - prev7Days) / prev7Days) * 1000) / 10;
    return {
      value: Math.abs(percentageChange),
      isPositive: percentageChange >= 0,
      label: 'نسبت به هفته پیش'
    };
  };

  const calculateTrendForRevenue = (items: Payment[]) => {
    const nowTime = now.getTime();

    const last7DaysSum = items
      .filter(pay => pay.status === 'success')
      .filter(pay => {
        const payTime = new Date(pay.created_at).getTime();
        return payTime >= nowTime - SEVEN_DAYS_MS && payTime <= nowTime;
      })
      .reduce((sum, pay) => sum + pay.amount, 0);

    const prev7DaysSum = items
      .filter(pay => pay.status === 'success')
      .filter(pay => {
        const payTime = new Date(pay.created_at).getTime();
        return payTime >= nowTime - 2 * SEVEN_DAYS_MS && payTime < nowTime - SEVEN_DAYS_MS;
      })
      .reduce((sum, pay) => sum + pay.amount, 0);

    if (prev7DaysSum === 0) {
      if (last7DaysSum === 0) {
        return { value: 0, isPositive: true, label: 'بدون تغییر' };
      }
      return { value: 0, isPositive: true, label: 'درآمد جدید', valueText: 'جدید' };
    }

    const percentageChange = Math.round(((last7DaysSum - prev7DaysSum) / prev7DaysSum) * 1000) / 10;
    return {
      value: Math.abs(percentageChange),
      isPositive: percentageChange >= 0,
      label: 'نسبت به هفته پیش'
    };
  };

  const usersTrend = calculateTrendForCount(profiles);
  const subsTrend = calculateTrendForCount(subscriptions.filter(s => s.status === 'active'));
  const revenueTrend = calculateTrendForRevenue(payments);
  const expiredDiscounts = discounts.filter(d => !d.is_active || (d.expires_at && new Date(d.expires_at).getTime() < now.getTime())).length;
  const discountsTrend = {
    value: 0,
    isPositive: false,
    label: 'غیرفعال یا منقضی',
    valueText: `${expiredDiscounts.toLocaleString('fa-IR')} کد`,
  };

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
            onClick={() => loadAllData(true)}
            disabled={isRefreshing}
            className="px-4 py-2 text-xs font-bold bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white rounded-xl transition-all flex items-center space-x-2 space-x-reverse cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{isRefreshing ? 'در حال بروزرسانی...' : 'بروزرسانی زنده داده‌ها'}</span>
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
          trend={usersTrend}
          iconColorClass="text-brand-400 bg-brand-500/10"
        />
        <StatsCard
          id="stat-subs"
          title="اشتراک‌های فعال"
          value={activeSubs}
          icon={CreditCard}
          trend={subsTrend}
          iconColorClass="text-purple-400 bg-purple-500/10"
        />
        <StatsCard
          id="stat-revenue"
          title="کل درآمد کسب شده"
          value={formatToman(totalRevenue)}
          icon={CircleDollarSign}
          trend={revenueTrend}
          iconColorClass="text-emerald-400 bg-emerald-500/10"
        />
        <StatsCard
          id="stat-discounts"
          title="کدهای تخفیف فعال"
          value={activePromoCodes}
          icon={Tag}
          trend={discountsTrend}
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
          <RecentPayments payments={[...payments].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5)} />
        </Card>
      </div>

    </motion.div>
  );
};
