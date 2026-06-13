import React, { useEffect, useState } from 'react';
import { dataStore, sanitizeCampaignDetail } from '../lib/dataStore';
import {
  TrafficOverview,
  FunnelStageRow,
  PurchaseTimingRow,
  RetentionRow,
  ChannelRoiRow,
  CampaignSummary,
  CampaignDetail
} from '../lib/supabase';
import { StatsCard } from '../components/ui/StatsCard';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Card } from '../components/ui/Card';
import { FunnelChart } from '../components/charts/FunnelChart';
import { RetentionMatrix } from '../components/charts/RetentionMatrix';
import { ChannelRoiTable } from '../components/marketing/ChannelRoiTable';
import { CampaignEditorModal } from '../components/marketing/CampaignEditorModal';
import { CampaignsManagerModal } from '../components/marketing/CampaignsManagerModal';
import {
  Users,
  Eye,
  MousePointerClick,
  TrendingUp,
  Award,
  Plus,
  Edit3,
  BarChart2,
  Calendar,
  Grid,
  Percent,
  Search,
  DollarSign
} from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';

export const MarketingDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [traffic, setTraffic] = useState<TrafficOverview[]>([]);
  const [funnel, setFunnel] = useState<FunnelStageRow[]>([]);
  const [purchaseTiming, setPurchaseTiming] = useState<PurchaseTimingRow[]>([]);
  const [retention, setRetention] = useState<RetentionRow[]>([]);
  const [roi, setRoi] = useState<ChannelRoiRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);

  // Filters
  const [selectedFunnelChannel, setSelectedFunnelChannel] = useState<string>('all');
  const [selectedTimingChannel, setSelectedTimingChannel] = useState<string>('all');
  
  // Funnel & Timing conditional loading
  const [loadingFunnel, setLoadingFunnel] = useState(false);
  const [loadingTiming, setLoadingTiming] = useState(false);

  // Campaign Explorer states
  const [selectedCampaignUtm, setSelectedCampaignUtm] = useState<string>('');
  const [selectedCampaignDetail, setSelectedCampaignDetail] = useState<CampaignDetail | null>(null);
  const [loadingCampaignDetail, setLoadingCampaignDetail] = useState(false);
  
  // Modals state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorCampaign, setEditorCampaign] = useState<CampaignSummary | null>(null);
  const [isManagerOpen, setIsManagerOpen] = useState(false);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [t, f, pt, r, roiData, camps] = await Promise.all([
        dataStore.getMarketingTraffic(),
        dataStore.getMarketingFunnel(),
        dataStore.getMarketingPurchaseTiming(),
        dataStore.getMarketingRetention(),
        dataStore.getMarketingRoi(),
        dataStore.getMarketingCampaigns()
      ]);

      setTraffic(t);
      setFunnel(f);
      setPurchaseTiming(pt);
      setRetention(r);
      setRoi(roiData);
      
      const activeCamps = (camps || []).filter(c => !c.notes?.includes('[DELETED]'));
      setCampaigns(activeCamps);

      // Auto-select first campaign if exists
      if (activeCamps && activeCamps.length > 0) {
        setSelectedCampaignUtm(activeCamps[0].utm_campaign);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('خطا در بارگذاری اولیه داده‌های بازاریابی');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Handle selected channel changing for Funnel channelling
  useEffect(() => {
    if (loading) return;
    const fetchFunnelFiltered = async () => {
      try {
        setLoadingFunnel(true);
        const channelParam = selectedFunnelChannel === 'all' ? undefined : selectedFunnelChannel;
        const res = await dataStore.getMarketingFunnel(channelParam);
        setFunnel(res);
      } catch (err) {
        console.error(err);
        toast.error('خطا در فیلتر کردن اطلاعات قیف تبدیل');
      } finally {
        setLoadingFunnel(false);
      }
    };
    fetchFunnelFiltered();
  }, [selectedFunnelChannel]);

  // Handle selected channel changing for Purchase Timings
  useEffect(() => {
    if (loading) return;
    const fetchTimingFiltered = async () => {
      try {
        setLoadingTiming(true);
        const channelParam = selectedTimingChannel === 'all' ? undefined : selectedTimingChannel;
        const res = await dataStore.getMarketingPurchaseTiming(channelParam);
        setPurchaseTiming(res);
      } catch (err) {
        console.error(err);
        toast.error('خطا در فیلتر کردن توزیع زمان خرید');
      } finally {
        setLoadingTiming(false);
      }
    };
    fetchTimingFiltered();
  }, [selectedTimingChannel]);

  // Handle campaign detailing fetch
  useEffect(() => {
    if (!selectedCampaignUtm) {
      setSelectedCampaignDetail(null);
      return;
    }
    const fetchCampaignDetail = async () => {
      try {
        setLoadingCampaignDetail(true);
        const res = await dataStore.getMarketingCampaignDetail(selectedCampaignUtm);
        setSelectedCampaignDetail(res ? sanitizeCampaignDetail(res) : null);
      } catch (err) {
        console.error(err);
        toast.error('خطا در دریافت عملکرد اختصاصی کمپین');
      } finally {
        setLoadingCampaignDetail(false);
      }
    };
    fetchCampaignDetail();
  }, [selectedCampaignUtm]);

  if (loading) {
    return <LoadingSpinner size="lg" message="در حال ساخت ماتریس‌های هوش بازاریابی و اتریبیوشن..." />;
  }

  // Calculate Traffic stats globally
  const totalVisitors30d = traffic.reduce((acc, curr) => acc + (curr.uniques_30d || 0), 0);
  const totalPageviews30d = traffic.reduce((acc, curr) => acc + (curr.page_views_30d || 0), 0);
  const totalCtaStartClicks30d = traffic.reduce((acc, curr) => acc + (curr.cta_start_free_clicks_30d || 0), 0);
  const totalCtaLoginClicks30d = traffic.reduce((acc, curr) => acc + (curr.cta_login_clicks_30d || 0), 0);
  const uniquesToday = traffic.reduce((acc, curr) => acc + (curr.uniques_today || 0), 0);

  // Get distinct channels for filters
  const availableChannels = Array.from(new Set(roi.map((r) => r.channel)));

  // Format monetary value helper
  const formatToman = (val: number) => {
    const tomanVal = Math.round(val / 10);
    return `${tomanVal.toLocaleString('fa-IR')} تومان`;
  };

  // Callback to handle saving a campaign from modal editor
  const handleSaveCampaign = async (payload: any) => {
    try {
      const success = await dataStore.saveMarketingCampaign(payload);
      if (success) {
        // Refetch campaign list & ROI table (since cost changes overall channel cost)
        const [updatedCamps, updatedRoi] = await Promise.all([
          dataStore.getMarketingCampaigns(),
          dataStore.getMarketingRoi()
        ]);
        const activeCamps = (updatedCamps || []).filter(c => !c.notes?.includes('[DELETED]'));
        setCampaigns(activeCamps);
        setRoi(updatedRoi);

        // Update active selection to keep view fresh
        setSelectedCampaignUtm(payload.utm_campaign);
        return true;
      }
      return false;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  // Convert categories label helper for progress bars
  const TIMING_LABELS: Record<string, string> = {
    'never_purchased': 'هرگز خرید نکرده‌اند',
    'at_registration': 'هم‌زمان با ثبت‌نام اولیه',
    'during_free_trial': 'در طول دوره‌ی آزمایشی',
    'after_trial': 'پس از اتمام دوره آزمایشی',
  };

  const getTimingColor = (cat: string) => {
    if (cat === 'never_purchased') return 'bg-rose-500/20 text-rose-400';
    if (cat === 'at_registration') return 'bg-indigo-500/20 text-indigo-400';
    if (cat === 'during_free_trial') return 'bg-blue-500/20 text-blue-400';
    return 'bg-emerald-500/20 text-emerald-400';
  };

  const getTimingBarColor = (cat: string) => {
    if (cat === 'never_purchased') return 'bg-rose-500';
    if (cat === 'at_registration') return 'bg-indigo-500';
    if (cat === 'during_free_trial') return 'bg-blue-500';
    return 'bg-emerald-500';
  };

  const activeSelectedCampaign = campaigns.find(c => c.utm_campaign === selectedCampaignUtm) || null;

  return (
    <div id="marketing-dashboard-root" className="space-y-6 text-right font-sans">
      
      {/* Page Title & New Campaign Action */}
      <div id="marketing-header" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <h2 id="marketing-title" className="text-xl md:text-2xl font-bold text-white tracking-tight">تحلیل هوشمند مارکتینگ و اتریبیوشن</h2>
          <p id="marketing-desc" className="text-xs text-slate-400 mt-1">مانیتور جامع سفر مشتری، نرخ‌های تبدیل کوهورت، عملکرد کمپین‌ها و نرخ بازگشت سرمایه‌گذاری (ROI)</p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-center">
          <button
            id="manage-campaigns-btn"
            onClick={() => setIsManagerOpen(true)}
            className="flex items-center justify-center space-x-2 space-x-reverse px-5 py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700/50 font-bold rounded-xl text-xs transition-all cursor-pointer"
          >
            <BarChart2 className="w-4 h-4 text-brand-400" />
            <span>مدیریت و آمار کمپین‌ها</span>
          </button>
          <button
            id="create-campaign-btn"
            onClick={() => {
              setEditorCampaign(null);
              setIsEditorOpen(true);
            }}
            className="flex items-center justify-center space-x-2 space-x-reverse px-5 py-3 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-xs shadow-lg shadow-brand-500/15 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت کمپین جدید</span>
          </button>
        </div>
      </div>

      {/* ۱. کارت‌های ترافیک (KPI Blocks) */}
      <div id="traffic-stats-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          id="stat-traffic-today"
          title="بازدیدکنندگان یکتای امروز"
          value={uniquesToday.toLocaleString('fa-IR')}
          icon={Users}
          iconColorClass="text-brand-400 bg-brand-500/10"
        />
        <StatsCard
          id="stat-traffic-30d"
          title="بازدیدکنندگان یکتای ۳۰ روزه"
          value={totalVisitors30d.toLocaleString('fa-IR')}
          icon={Eye}
          iconColorClass="text-indigo-400 bg-indigo-500/10"
        />
        <StatsCard
          id="stat-pageviews-30d"
          title="تعداد بازدید صفحات"
          value={totalPageviews30d.toLocaleString('fa-IR')}
          icon={Award}
          iconColorClass="text-blue-400 bg-blue-500/10"
        />
        <StatsCard
          id="stat-cta-start-30d"
          title="کلیک فعال‌سازی (۳۰ روزه)"
          value={totalCtaStartClicks30d.toLocaleString('fa-IR')}
          icon={TrendingUp}
          iconColorClass="text-emerald-400 bg-emerald-500/10"
          trend={{
            value: totalCtaStartClicks30d > 0 ? Math.round((totalCtaStartClicks30d / (totalCtaStartClicks30d + totalCtaLoginClicks30d)) * 100) : 0,
            isPositive: true,
            label: 'سهم از کل اقدامات وب‌سایت'
          }}
        />
      </div>

      {/* Second Row: Funnel Matrix and Purchase Timing Distribution */}
      <div id="visualizer-grid" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ۲. قیف تبدیل ریپورتر */}
        <Card id="funnel-container-card" hoverable={false} className="lg:col-span-7 flex flex-col relative">
          <div id="funnel-header" className="flex items-center justify-between pb-6 border-b border-white/5 mb-6">
            <div className="flex items-center space-x-2.5 space-x-reverse">
              <div className="p-2 bg-brand-500/10 rounded-lg text-brand-400">
                <BarChart2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">قیف تبدیل مشتریان</h3>
            </div>
            
            {/* Channel filter */}
            <select
              id="funnel-channel-filter"
              value={selectedFunnelChannel}
              onChange={(e) => setSelectedFunnelChannel(e.target.value)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 font-semibold cursor-pointer outline-none focus:border-brand-500"
            >
              <option value="all">تمام کانال‌ها</option>
              {availableChannels.map((chan) => (
                <option key={`funnel-${chan}`} value={chan}>کانال: {chan}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 relative">
            {loadingFunnel ? (
              <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-10 rounded-xl">
                <LoadingSpinner size="md" message="بارگذاری..." />
              </div>
            ) : null}
            <FunnelChart data={funnel} />
          </div>
        </Card>

        {/* ۳. توزیع زمان خرید */}
        <Card id="purchase-timing-card" hoverable={false} className="lg:col-span-5 flex flex-col">
          <div id="timing-header" className="flex items-center justify-between pb-6 border-b border-white/5 mb-6">
            <div className="flex items-center space-x-2.5 space-x-reverse">
              <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                <Calendar className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">توزیع زمان خرید کاربران</h3>
            </div>
            
            {/* Timing filter */}
            <select
              id="timing-channel-filter"
              value={selectedTimingChannel}
              onChange={(e) => setSelectedTimingChannel(e.target.value)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 font-semibold cursor-pointer outline-none focus:border-brand-500"
            >
              <option value="all">تمام کانال‌ها</option>
              {availableChannels.map((chan) => (
                <option key={`timing-${chan}`} value={chan}>کانال: {chan}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 relative flex flex-col justify-center space-y-5">
            {loadingTiming ? (
              <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-10 rounded-xl">
                <LoadingSpinner size="md" message="بارگذاری..." />
              </div>
            ) : null}

            {purchaseTiming.length === 0 ? (
              <div className="text-center text-slate-500 text-xs py-8">اطلاعات زمان خرید یافت نشد.</div>
            ) : (
              (() => {
                const totalCalculatedUsers = purchaseTiming.reduce((acc, curr) => acc + curr.user_count, 0);
                return purchaseTiming.map((row) => {
                  const percentage = totalCalculatedUsers > 0 ? (row.user_count / totalCalculatedUsers) * 100 : 0;
                  const label = TIMING_LABELS[row.timing_category] || row.timing_category;
                  const pillColor = getTimingColor(row.timing_category);
                  const barColor = getTimingBarColor(row.timing_category);

                  return (
                    <div key={row.timing_category} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${pillColor}`}>{label}</span>
                        <div className="flex items-center space-x-2 space-x-reverse font-mono text-slate-400 pr-2">
                          <span>{row.user_count.toLocaleString('fa-IR')} کاربر</span>
                          <span className="text-slate-600">|</span>
                          <span className="text-slate-300 font-bold">{(percentage || 0).toFixed(1)}٪</span>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barColor}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                });
              })()
            )}
          </div>
        </Card>
      </div>

      {/* Third Row: Cohort Retention Heatmap Matrix */}
      <Card id="retention-matrix-card" hoverable={false} className="flex flex-col">
        <div id="retention-header" className="flex items-center space-x-2.5 space-x-reverse pb-6 border-b border-white/5 mb-6">
          <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
            <Grid className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">ماتریس ماندگاری کاربران به تفکیک کانال ورودی (حرارتی)</h3>
            <p className="text-[10px] text-slate-500 mt-1">درصد کاربران فعالی که در بازه‌های ۳۰، ۶۰، ۹۰ و ۱۸۰ روز اخیر پس از ثبت‌نام به سرویس بازگشته يا لاگين داشته‌اند.</p>
          </div>
        </div>
        <RetentionMatrix data={retention} />
      </Card>

      {/* Fourth Row: ROI table */}
      <Card id="roi-table-card" hoverable={false} className="flex flex-col">
        <div id="roi-header" className="flex items-center space-x-2.5 space-x-reverse pb-6 border-b border-white/5 mb-6">
          <div className="p-2 bg-brand-500/10 rounded-lg text-brand-400">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">عملکرد مالی و نرخ بازگشت سرمایه‌گذاری (ROI) کانال‌ها</h3>
            <p className="text-[10px] text-slate-500 mt-1">محاسبه خودکار شاخص برآورد هزینه جذب کاربری (CAC) و برآورد خالص سوددهی هزینه‌های انجام‌شده به تفکیک لایه‌های FDW</p>
          </div>
        </div>
        <ChannelRoiTable data={roi} />
      </Card>

      {/* Fifth Row: Campaign Analyzer Deep explorer */}
      <Card id="campaign-explorer-card" hoverable={false} className="flex flex-col">
        <div id="camps-header" className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-white/5 mb-6 gap-4">
          <div className="flex items-center space-x-2.5 space-x-reverse">
            <div className="p-2 bg-brand-400/10 rounded-lg text-brand-400">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">تحلیل دقیق و کاوش عمیق عملکرد تک‌کمپینی</h3>
              <p className="text-[10px] text-slate-500 mt-1">با انتخاب کمپین جزئیات هزینه، نرخ تبدیل و ROI به شکل زنده از foreign table دیتابیس تحلیلی واکشی می‌شود.</p>
            </div>
          </div>

          {/* Selector campaign */}
          <div className="flex items-center space-x-3 space-x-reverse">
            <select
              id="selected-campaign-select"
              value={selectedCampaignUtm}
              onChange={(e) => setSelectedCampaignUtm(e.target.value)}
              className="px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-bold cursor-pointer outline-none focus:border-brand-500 min-w-[200px]"
            >
              {campaigns.length === 0 ? (
                <option value="">کمپینی تعریف نشده است</option>
              ) : (
                campaigns.map((camp) => (
                  <option key={camp.utm_campaign} value={camp.utm_campaign}>
                    کمپین: {camp.utm_campaign}
                  </option>
                ))
              )}
            </select>

            {/* Edit active selected campaign button */}
            {activeSelectedCampaign && (
              <button
                id="edit-selected-camp-btn"
                onClick={() => {
                  setEditorCampaign(activeSelectedCampaign);
                  setIsEditorOpen(true);
                }}
                className="flex items-center space-x-1.5 space-x-reverse px-3 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer border border-slate-700/50"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>ویرایش هزینه و جزئیات</span>
              </button>
            )}
          </div>
        </div>

        {/* Detailed summary widget */}
        <div className="relative">
          {loadingCampaignDetail ? (
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-10 rounded-xl" style={{ minHeight: 180 }}>
              <LoadingSpinner size="md" message="در حال واکشی آمار دقیق کمپین..." />
            </div>
          ) : null}

          {!selectedCampaignDetail ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 text-xs">
              کمپین تبلیغاتی مناسبی پیدا نشد؛ لطفا با ثبت کمپین جدید آغاز به ثبت هزینه‌ها کنید.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4" style={{ minHeight: 180 }}>
              {/* Box 1: Core details */}
              <div className="p-5 bg-slate-950/40 border border-slate-800/60 rounded-2xl flex flex-col justify-between">
                <div>
                  <span className="text-xs text-slate-500 font-medium">مشخصات عمومی</span>
                  <h4 className="text-sm font-bold text-white mt-2 mb-1 truncate">{selectedCampaignDetail.utm_campaign}</h4>
                  <div className="flex items-center space-x-2 space-x-reverse text-xs text-slate-400">
                    <span>کانال:</span>
                    <span className="px-2 py-0.5 bg-slate-800 rounded font-semibold">{activeSelectedCampaign?.channel || '-'}</span>
                  </div>
                </div>
                {activeSelectedCampaign?.notes && (
                  <p className="text-[10px] text-slate-400 mt-3 border-t border-slate-800/40 pt-2 line-clamp-2">
                    یادداشت ادمین: {activeSelectedCampaign.notes}
                  </p>
                )}
              </div>

              {/* Box 2: Cost & Revenue */}
              <div className="p-5 bg-slate-950/40 border border-slate-800/60 rounded-2xl flex flex-col justify-between">
                <div>
                  <span className="text-xs text-slate-500 font-medium font-sans">عملکرد مالی</span>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">کل هزینه خرید:</span>
                      <span className="font-mono font-bold text-slate-200">{formatToman(selectedCampaignDetail.total_cost)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">حمایت درآمدی:</span>
                      <span className="font-mono font-bold text-emerald-400">{formatToman(selectedCampaignDetail.revenue)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-slate-800/40 pt-2">
                  <span className="text-slate-500 font-bold">میزان سود ناخالص:</span>
                  <span className={`font-mono font-bold text-xs ${(selectedCampaignDetail.roi || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {(selectedCampaignDetail.roi || 0) >= 0 ? '+' : ''}{Number(selectedCampaignDetail.roi || 0).toFixed(1)}٪
                  </span>
                </div>
              </div>

              {/* Box 3: CAC indices */}
              <div className="p-5 bg-slate-950/40 border border-slate-800/60 rounded-2xl flex flex-col justify-between">
                <div>
                  <span className="text-xs text-slate-500 font-medium">شاخص جذب (CAC)</span>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-sans">شاخص CAC کمپین:</span>
                      <span className="font-mono font-bold text-slate-200">{formatToman(selectedCampaignDetail.cac)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">توزیع بازدیدکننده:</span>
                      <span className="font-mono text-slate-300">{selectedCampaignDetail.visitors.toLocaleString('fa-IR')} کاربر</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-500 border-t border-slate-800/40 pt-2 font-medium">
                  <span>میانگین هزینه‌کرد ما به‌ازای هر ورود خلاق کمپینی</span>
                </div>
              </div>

              {/* Box 4: Registrations & conversion */}
              <div className="p-5 bg-slate-950/40 border border-slate-800/60 rounded-2xl flex flex-col justify-between">
                <div>
                  <span className="text-xs text-slate-500 font-medium font-sans">جذب تبدیل و نرخ ثبت‌نام</span>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">ثبت‌نام کرده:</span>
                      <span className="font-mono font-bold text-indigo-400">{selectedCampaignDetail.registrations.toLocaleString('fa-IR')}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">خریدار عضو:</span>
                      <span className="font-mono font-bold text-emerald-400">{selectedCampaignDetail.buyers.toLocaleString('fa-IR')}</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-slate-800/40 pt-2">
                  <span className="text-slate-500 font-bold">نرخ کل تبدیل:</span>
                  <span className="font-mono font-bold text-indigo-400">{Number(selectedCampaignDetail.conversion_rate || 0).toFixed(2)}٪</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Campaign Editor Modal */}
      <CampaignEditorModal
        id="campaign-editor-modal"
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        campaign={editorCampaign}
        onSave={handleSaveCampaign}
      />

      {/* Campaigns Manager & Analytical Insights Modal */}
      <CampaignsManagerModal
        id="campaigns-manager-modal"
        isOpen={isManagerOpen}
        onClose={() => {
          setIsManagerOpen(false);
          // Refetch to ensure any edited campaign values are in sync
          loadAllData();
        }}
        onEditCampaign={(camp) => {
          setIsManagerOpen(false);
          setEditorCampaign(camp);
          setIsEditorOpen(true);
        }}
      />
    </div>
  );
};
