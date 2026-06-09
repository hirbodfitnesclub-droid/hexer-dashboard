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

  // Modern Date/Time grouping with Intl API (toLocaleDateString)
  // Revenue grouped by Persian date representation
  const successPayments = [...payments]
    .filter(pay => pay.status === 'success')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const revenueDateMap = new Map<string, number>();
  successPayments.forEach(pay => {
    const dateObj = new Date(pay.created_at);
    const dateStr = dateObj.toLocaleDateString('fa-IR', {
      month: 'long',
      day: 'numeric'
    });
    revenueDateMap.set(dateStr, (revenueDateMap.get(dateStr) || 0) + pay.amount);
  });

  const revenueChartData = revenueDateMap.size > 0 
    ? Array.from(revenueDateMap.entries()).map(([date, amount]) => ({ date, amount: amount / 10 }))
    : [{ date: 'امروز', amount: 0 }];

  // Cumulative User Growth grouped by signup date
  const sortedProfiles = [...profiles]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const userDateMap = new Map<string, number>();
  let userCumulativeCount = 0;
  sortedProfiles.forEach(prof => {
    userCumulativeCount += 1;
    const dateObj = new Date(prof.created_at);
    const dateStr = dateObj.toLocaleDateString('fa-IR', {
      month: 'long',
      day: 'numeric'
    });
    userDateMap.set(dateStr, userCumulativeCount);
  });

  const userGrowthData = userDateMap.size > 0
    ? Array.from(userDateMap.entries()).map(([date, count]) => ({ date, count }))
    : [{ date: 'امروز', count: 0 }];

  // Group plans distribution (using both plan_code and plan_id defensively)
  const planDistribution = Object.entries(PLAN_CONFIGS).map(([key, config]) => {
    return {
      name: key === 'free' ? 'پلن آزمایشی (رایگان)' : `پلن ${config.name}`,
      value: subscriptions.filter(s => {
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
      return {
        value: last7Days > 0 ? 100 : 0,
        isPositive: true,
        label: 'نسبت به هفته پیش'
      };
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
      return {
        value: last7DaysSum > 0 ? 100 : 0,
        isPositive: true,
        label: 'نسبت به هفته پیش'
      };
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
  const discountsTrend = {
    value: discounts.filter(d => !d.is_active || (d.expires_at && new Date(d.expires_at).getTime() < now.getTime())).length,
    isPositive: false,
    label: 'کدهای غیرفعال یا منقضی'
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
          value={`${(totalRevenue / 10).toLocaleString('fa-IR')} تومان`}
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
          <RecentPayments payments={payments.slice(0, 5)} />
        </Card>
      </div>

    </motion.div>
  );
};
