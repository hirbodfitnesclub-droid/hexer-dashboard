import React, { useState, useEffect } from 'react';
import { ModalWrapper } from '../ui/ModalWrapper';
import { CampaignSummary, CampaignDetail } from '../../lib/supabase';
import { dataStore } from '../../lib/dataStore';
import { format } from 'date-fns-jalali';
import { 
  Eye, 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  RefreshCcw,
  BarChart3,
  Activity,
  Edit3,
  Copy,
  Check,
  Calendar,
  Coins,
  Link
} from 'lucide-react';

interface CampaignsManagerModalProps {
  id: string;
  isOpen: boolean;
  onClose: () => void;
  onEditCampaign: (campaign: CampaignSummary) => void;
}

export const CampaignsManagerModal: React.FC<CampaignsManagerModalProps> = ({
  id,
  isOpen,
  onClose,
  onEditCampaign,
}) => {
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [selectedUtm, setSelectedUtm] = useState<string | null>(null);
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);

  // Fetch campaigns
  const fetchCampaignsList = async () => {
    setIsLoadingList(true);
    try {
      const list = await dataStore.getMarketingCampaigns();
      // Sort descending by start_date or created_at
      const sorted = [...list].sort((a, b) => {
        const dateA = a.start_date ? new Date(a.start_date).getTime() : new Date(a.created_at).getTime();
        const dateB = b.start_date ? new Date(b.start_date).getTime() : new Date(b.created_at).getTime();
        return dateB - dateA;
      });
      setCampaigns(sorted);
    } catch (err) {
      console.error('Error loading campaigns list:', err);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setView('list');
      setDetail(null);
      setSelectedUtm(null);
      setDetailError(false);
      fetchCampaignsList();
    }
  }, [isOpen]);

  const handleShowDetail = async (utmCampaign: string) => {
    setSelectedUtm(utmCampaign);
    setView('detail');
    setIsLoadingDetail(true);
    setDetailError(false);
    try {
      const data = await dataStore.getMarketingCampaignDetail(utmCampaign);
      if (!data) {
        // Build fallback detail if API returned null (success but no traffic/marketing data yet)
        const activeCampaign = campaigns.find(c => c.utm_campaign === utmCampaign);
        const cost_irr = activeCampaign ? activeCampaign.cost_irr : 0;
        const fallbackDetail: CampaignDetail = {
          utm_campaign: utmCampaign,
          channel: activeCampaign?.channel || '',
          visitors: 0,
          registrations: 0,
          buyers: 0,
          conversion_rate: 0,
          total_cost: cost_irr,
          revenue: 0,
          roi: cost_irr > 0 ? -100 : 0,
          cac: 0,
        };
        setDetail(fallbackDetail);
      } else {
        setDetail(data);
      }
    } catch (err) {
      console.error('Error fetching campaign detail:', err);
      setDetailError(true);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Helper formats
  const formatToman = (irrValue: number) => {
    const toman = Math.round(irrValue / 10);
    return toman.toLocaleString('fa-IR') + ' تومان';
  };

  const getJalaliDateLabel = (dateStr: string | null) => {
    if (!dateStr) return 'ثبت نشده';
    try {
      const d = new Date(dateStr);
      return format(d, 'yyyy/MM/dd');
    } catch {
      return 'خطای تاریخ';
    }
  };

  const filteredCampaigns = campaigns.filter(c => {
    const searchLower = searchTerm.toLowerCase();
    return (
      c.utm_campaign.toLowerCase().includes(searchLower) ||
      (c.channel && c.channel.toLowerCase().includes(searchLower)) ||
      (c.source_name && c.source_name.toLowerCase().includes(searchLower))
    );
  });

  const campaignInfo = campaigns.find(c => c.utm_campaign === selectedUtm);

  return (
    <ModalWrapper
      id={id}
      isOpen={isOpen}
      onClose={onClose}
      title={view === 'list' ? 'مدیریت و تحلیل کمپین‌های تبلیغاتی' : `آمار کمپین تبلیغاتی: ${selectedUtm}`}
      maxWidthClass={view === 'list' ? 'max-w-4xl' : 'max-w-2xl'}
    >
      <div className="flex flex-col max-h-[75vh] md:max-h-[80vh] text-right min-h-[350px]">
        {view === 'list' ? (
          <>
            {/* Search and reload header */}
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap shrink-0">
              <button
                type="button"
                onClick={fetchCampaignsList}
                disabled={isLoadingList}
                className="p-2.5 bg-slate-950/40 hover:bg-slate-950/80 text-slate-400 hover:text-brand-400 border border-slate-800 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                title="بارگذاری مجدد لیست"
              >
                <RefreshCcw className={`w-4 h-4 ${isLoadingList ? 'animate-spin' : ''}`} />
                <span>به‌روزرسانی</span>
              </button>

              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="جستجو در شناسه، کانال یا رسانه..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full text-right px-4 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            {/* List Table/Card view */}
            <div className="flex-1 overflow-y-auto pr-1 pl-1 min-h-0 [scrollbar-width:thin] scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
              {isLoadingList ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-slate-400 text-xs font-bold">درحال واکشی اطلاعات کمپین‌ها...</span>
                </div>
              ) : filteredCampaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 border border-dashed border-slate-800 rounded-2xl bg-slate-950/10">
                  <BarChart3 className="w-10 h-10 text-slate-600 mb-3" />
                  <p className="text-slate-400 text-sm font-bold">هیچ کمپین فعالی با مشخصات وارد شده یافت نشد.</p>
                  <p className="text-slate-500 text-xs mt-1">از دکمه ثبت کمپین برای ایجاد یک کانال جدید استفاده کنید.</p>
                </div>
              ) : (
                <>
                  {/* Desktop Table view */}
                  <div className="hidden md:block overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/20">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-slate-950/50 border-b border-slate-800 text-slate-400 font-bold">
                          <th className="p-3">شناسه کمپین (UTM)</th>
                          <th className="p-3">کانال مدیا</th>
                          <th className="p-3">رسانه / پیج</th>
                          <th className="p-3">تاریخ شروع</th>
                          <th className="p-3 text-left">هزینه</th>
                          <th className="p-3 text-center w-24">عملیات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCampaigns.map((c) => (
                          <tr key={c.utm_campaign} className="border-b border-slate-850 hover:bg-slate-900/40 transition-colors text-slate-300">
                            <td className="p-3 font-mono font-medium text-slate-200">{c.utm_campaign}</td>
                            <td className="p-3">
                              <span className="px-2 py-1 rounded bg-slate-800 text-slate-200 text-[10px] font-semibold">
                                {c.channel}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-[11px] text-slate-400">{c.source_name || '-'}</td>
                            <td className="p-3 text-slate-400">{getJalaliDateLabel(c.start_date)}</td>
                            <td className="p-3 font-mono text-left font-bold text-emerald-400">
                              {formatToman(c.cost_irr)}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleShowDetail(c.utm_campaign)}
                                className="p-1.5 bg-brand-500/10 hover:bg-brand-500 text-brand-400 hover:text-white rounded-lg border border-brand-500/20 transition-all cursor-pointer inline-flex items-center gap-1 font-bold text-[10px]"
                                title="مشاهده آمار عملکرد"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>آمار</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card view */}
                  <div className="grid grid-cols-1 gap-3 md:hidden">
                    {filteredCampaigns.map((c) => (
                      <div key={c.utm_campaign} className="p-4 bg-slate-950/30 border border-slate-800 rounded-xl space-y-3 text-right">
                        <div className="flex items-start justify-between">
                          <span className="font-mono text-sm font-bold text-slate-100">{c.utm_campaign}</span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 text-[9px] font-semibold">
                            {c.channel}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 border-t border-b border-slate-850 py-2">
                          <div className="text-right">
                            <span className="block text-[10px] text-slate-500">رسانه:</span>
                            <span className="font-mono text-slate-300">{c.source_name || '-'}</span>
                          </div>
                          <div className="text-right">
                            <span className="block text-[10px] text-slate-500">تاریخ شروع:</span>
                            <span className="text-slate-300">{getJalaliDateLabel(c.start_date)}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 block">هزینه کل:</span>
                            <span className="font-mono font-bold text-emerald-400">{formatToman(c.cost_irr)}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleShowDetail(c.utm_campaign)}
                            className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 text-[11px] font-bold"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>مشاهده آمار</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Sticky footer with close */}
            <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 pt-4 mt-4 flex justify-end shrink-0 z-10">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                بستن پنجره
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Detail View */}
            {/* Header / Back */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setView('list');
                  setDetail(null);
                  setDetailError(false);
                }}
                className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-800 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>بازگشت به لیست</span>
              </button>

              {campaignInfo && (
                <button
                  type="button"
                  onClick={() => {
                    onEditCampaign(campaignInfo);
                  }}
                  className="flex items-center gap-1.5 text-xs font-bold text-brand-400 hover:text-white bg-brand-500/10 hover:bg-brand-500 border border-brand-500/20 hover:border-brand-500 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>ویرایش اطلاعات کمپین</span>
                </button>
              )}
            </div>

            {/* Detail core scroll body */}
            <div className="flex-1 overflow-y-auto pr-1 pl-1 min-h-0 [scrollbar-width:thin] space-y-4 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
              {isLoadingDetail ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-slate-400 text-xs font-bold">درحال بارگذاری تحلیل هوشمند کمپین...</p>
                </div>
              ) : detailError ? (
                <div className="text-center py-16">
                  <p className="text-red-400 font-bold text-sm">خطا در دریافت آمار کمپین تبلیغاتی</p>
                  <p className="text-slate-500 text-xs mt-1">لطفاً اتصال شبکه و پایگاه داده را بررسی کنید...</p>
                </div>
              ) : !detail ? (
                <div className="text-center py-16">
                  <p className="text-slate-400 text-sm font-bold">هیچ جزئیاتی یافت نشد</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* شناسنامه کمپین (Campaign Identity Card) */}
                  {campaignInfo && (
                    <div className="p-4 bg-slate-950/60 border border-slate-800/60 rounded-2xl space-y-3.5 text-right">
                      <div className="flex items-center justify-between border-b border-slate-900 pb-2.5">
                        <span className="text-[10px] text-slate-500 font-mono tracking-wider font-bold">CAMP PROFILE</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white font-mono">{campaignInfo.utm_campaign}</span>
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold border border-slate-700/50">
                            {campaignInfo.channel}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 block mb-1">رسانه / پیج تبلیغاتی</span>
                          <span className="text-slate-200 font-bold font-mono">{campaignInfo.source_name || 'ثبت نشده'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block mb-1">کف بودجه اختصاص‌یافته</span>
                          <span className="text-emerald-400 font-bold font-mono flex items-center gap-0.5">
                            <Coins className="w-3.5 h-3.5 text-amber-500/80 inline" />
                            <span>{formatToman(campaignInfo.cost_irr)}</span>
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-xs border-t border-slate-900/40 pt-2.5">
                        <div>
                          <span className="text-[10px] text-slate-500 block mb-1">تاریخ شروع تبلیغ</span>
                          <span className="text-slate-300 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-550 inline" />
                            <span>{getJalaliDateLabel(campaignInfo.start_date)}</span>
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block mb-1">تاریخ پایان تبلیغ</span>
                          <span className="text-slate-300 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-550 inline" />
                            <span>{getJalaliDateLabel(campaignInfo.end_date)}</span>
                          </span>
                        </div>
                      </div>

                      {campaignInfo.target_url && (
                        <div className="border-t border-slate-900/40 pt-2.5 space-y-1.5">
                          <span className="text-[10px] text-slate-500 block">لینک هدف نهایی (Target URL)</span>
                          <div className="flex items-center gap-2 bg-slate-950/80 p-2 rounded-xl border border-slate-900">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(campaignInfo.target_url || '');
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2000);
                              }}
                              className="p-1.5 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white rounded-lg border border-slate-800 transition-colors cursor-pointer"
                              title="کپی کردن آدرس لینک هدف"
                            >
                              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            <span className="flex-1 text-left font-mono text-[11px] text-slate-300 truncate dir-ltr">
                              {campaignInfo.target_url}
                            </span>
                          </div>
                        </div>
                      )}

                      {campaignInfo.notes && (
                        <div className="border-t border-slate-900/40 pt-2.5 text-xs">
                          <span className="text-[10px] text-slate-500 block mb-1">جزئیات و یادداشت کمپین</span>
                          <p className="text-slate-400 leading-relaxed text-[11px] bg-slate-900/30 p-2.5 rounded-lg border border-slate-900/50">
                            {campaignInfo.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ۱. کارت آماری ترافیک و تبدیل */}
                  <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-2xl">
                    <div className="flex items-center justify-between mb-3 border-b border-slate-900 pb-2">
                      <span className="text-[10px] text-slate-500 font-mono">FUNNEL & CONVERSIONS</span>
                      <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                        <span>ترافیک و نرخ تبدیل قیف</span>
                        <Users className="w-4 h-4 text-cyan-400" />
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-slate-950/60 border border-slate-900 rounded-xl text-center">
                        <span className="text-[10px] text-slate-500 block mb-1">بازدیدکننده‌ها</span>
                        <span className="font-mono text-base font-bold text-slate-200">
                          {detail.visitors.toLocaleString('fa-IR')}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-950/60 border border-slate-900 rounded-xl text-center">
                        <span className="text-[10px] text-slate-500 block mb-1">ثبت‌نامی‌ها</span>
                        <span className="font-mono text-base font-bold text-cyan-400">
                          {detail.registrations.toLocaleString('fa-IR')}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-950/60 border border-slate-900 rounded-xl text-center">
                        <span className="text-[10px] text-slate-500 block mb-1">خریداران قطعی</span>
                        <span className="font-mono text-base font-bold text-emerald-400">
                          {detail.buyers.toLocaleString('fa-IR')}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-950/60 border border-slate-900 rounded-xl text-center">
                        <span className="text-[10px] text-slate-500 block mb-1">نرخ تبدیل نهایی</span>
                        <span className="font-mono text-base font-bold text-amber-400">
                          {detail.conversion_rate.toLocaleString('fa-IR')}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ۲. بخش مالی و ROI */}
                  {(() => {
                    const costToman = Math.round(detail.total_cost / 10);
                    const revenueToman = Math.round(detail.revenue / 10);
                    const isProfit = detail.roi >= 0;
                    return (
                      <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-2xl">
                        <div className="flex items-center justify-between mb-3 border-b border-slate-900 pb-2">
                          <span className="text-[10px] text-slate-500 font-mono">FINANCIALS INDEX</span>
                          <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                            <span>جریان درآمدی و سود مالی</span>
                            {isProfit ? (
                              <TrendingUp className="w-4 h-4 text-emerald-400 animate-pulse" />
                            ) : (
                              <TrendingDown className="w-4 h-4 text-red-500 animate-pulse" />
                            )}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="p-3 bg-slate-950/60 border border-slate-900 rounded-xl text-center">
                            <span className="text-[10px] text-slate-500 block mb-1">هزینه نهایی کمپین</span>
                            <span className="font-mono text-sm font-bold text-slate-200">
                              {costToman.toLocaleString('fa-IR')} تومان
                            </span>
                          </div>
                          <div className="p-3 bg-slate-950/60 border border-slate-900 rounded-xl text-center">
                            <span className="text-[10px] text-slate-500 block mb-1">فروش ناخالص</span>
                            <span className="font-mono text-sm font-bold text-emerald-400">
                              {revenueToman.toLocaleString('fa-IR')} تومان
                            </span>
                          </div>
                          <div className={`p-3 border rounded-xl text-center flex flex-col justify-center ${
                            isProfit 
                              ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' 
                              : 'bg-red-500/5 border-red-500/20 text-red-400'
                          }`}>
                            <span className="text-[10px] opacity-80 block mb-0.5">نرخ بازگشت سرمایه (ROI)</span>
                            <span className="font-mono text-base font-bold">
                              {isProfit ? '+' : ''}{detail.roi.toLocaleString('fa-IR')}%
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ۳. شاخص جذب CAC */}
                  <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-2xl">
                    <div className="flex items-center justify-between mb-3 border-b border-slate-900 pb-2">
                      <span className="text-[10px] text-slate-500 font-mono">ACQUISITION COST INDEX</span>
                      <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                        <span>شاخص هزینه جذب مشتری (CAC)</span>
                        <Activity className="w-4 h-4 text-indigo-400" />
                      </span>
                    </div>

                    <div className="p-4 bg-slate-950/60 border border-slate-900 rounded-xl flex items-center justify-between flex-wrap gap-4 text-right">
                      <div className="space-y-1 flex-1 min-w-[200px]">
                        <span className="text-xs font-bold text-slate-200 block">هزینه نهایی جذب هر مشتری جدید</span>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          این عدد نشان‌دهنده مقدار سرمایه‌گذاری برای تبدیل یک بازدیدکننده عادی به خریدار پرداخت‌کننده دوره است. هر چه پایین‌تر باشد پرفورمنس بالاتری دارید.
                        </p>
                      </div>
                      <div className="px-5 py-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-center shrink-0 min-w-[150px]">
                        <span className="text-[10px] text-slate-500 block mb-1">CAC نهایی کمپین</span>
                        <span className="font-mono text-md font-bold text-indigo-400">
                          {Math.round(detail.cac / 10).toLocaleString('fa-IR')} تومان
                        </span>
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* Sticky close */}
            <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 pt-4 mt-4 flex justify-end shrink-0 z-10">
              <button
                type="button"
                onClick={() => {
                  setView('list');
                  setDetail(null);
                  setDetailError(false);
                }}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-755 text-slate-400 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                بازگشت به لیست
              </button>
            </div>
          </>
        )}
      </div>
    </ModalWrapper>
  );
};
