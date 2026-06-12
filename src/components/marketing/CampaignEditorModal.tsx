import React, { useState, useEffect } from 'react';
import { ModalWrapper } from '../ui/ModalWrapper';
import { CampaignSummary } from '../../lib/supabase';
import { 
  format, 
  parse, 
  addDays, 
  addWeeks, 
  addMonths, 
  isValid 
} from 'date-fns-jalali';
import { 
  Youtube, 
  Send, 
  Instagram, 
  Globe, 
  Megaphone, 
  FileText, 
  MousePointerClick, 
  Linkedin, 
  Copy, 
  Check, 
  Link, 
  Clock, 
  Calendar, 
  CalendarDays, 
  CalendarRange, 
  DollarSign, 
  Coins, 
  FileEdit,
  Edit2
} from 'lucide-react';

interface CampaignEditorModalProps {
  id: string;
  isOpen: boolean;
  onClose: () => void;
  campaign: CampaignSummary | null; // null means create new
  onSave: (payload: any) => Promise<boolean>;
}

const CHANNELS = [
  { value: 'youtube', label: 'یوتیوب (YouTube)', icon: Youtube, color: 'hover:text-red-500 hover:border-red-500/30' },
  { value: 'telegram', label: 'تلگرام (Telegram)', icon: Send, color: 'hover:text-sky-500 hover:border-sky-500/30' },
  { value: 'instagram', label: 'اینستاگرام (Instagram)', icon: Instagram, color: 'hover:text-pink-500 hover:border-pink-500/30' },
  { value: 'x_ugc', label: 'ایکس (UGC)', icon: Globe, color: 'hover:text-slate-200 hover:border-slate-200/30' },
  { value: 'x_business', label: 'ایکس (بیزنسی)', icon: Megaphone, color: 'hover:text-blue-400 hover:border-blue-400/30' },
  { value: 'reportage', label: 'رپورتاژ آگهی', icon: FileText, color: 'hover:text-yellow-500 hover:border-yellow-500/30' },
  { value: 'cpc', label: 'تبلیغات کلیکی', icon: MousePointerClick, color: 'hover:text-green-500 hover:border-green-500/30' },
  { value: 'linkedin', label: 'لینکدین (LinkedIn)', icon: Linkedin, color: 'hover:text-indigo-400 hover:border-indigo-400/30' },
];

const SCHEDULING_TYPES = [
  { value: 'hourly', label: 'ساعتی (Hourly)', icon: Clock },
  { value: 'daily', label: 'روزانه (Daily)', icon: Calendar },
  { value: 'weekly', label: 'هفتگی (Weekly)', icon: CalendarDays },
  { value: 'monthly', label: 'ماهانه (Monthly)', icon: CalendarRange },
];

// Helper to sanitize Persian/Arabic digits to Latin
const toEnglishDigits = (str: string): string => {
  const p2e: Record<string, string> = { 
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9', 
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' 
  };
  return str.replace(/[۰-۹٠-٩]/g, (c) => p2e[c] || c);
};

// Parse Jalali string "yyyy/MM/dd" back to a native Date object
const parseJalali = (jalaliStr: string): Date | null => {
  const sanitized = toEnglishDigits(jalaliStr).trim();
  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(sanitized)) return null;
  try {
    const d = parse(sanitized, 'yyyy/MM/dd', new Date());
    return isValid(d) ? d : null;
  } catch {
    return null;
  }
};

// Format native Date to Jalali string "yyyy/MM/dd"
const formatJalali = (date: Date): string => {
  return format(date, 'yyyy/MM/dd');
};

export const CampaignEditorModal: React.FC<CampaignEditorModalProps> = ({
  id,
  isOpen,
  onClose,
  campaign,
  onSave,
}) => {
  const [utmCampaign, setUtmCampaign] = useState('');
  const [channel, setChannel] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [costToman, setCostToman] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Scheduling specific states
  const [scheduleType, setScheduleType] = useState<'hourly' | 'daily' | 'weekly' | 'monthly'>('hourly');
  const [jalaliStartDate, setJalaliStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [duration, setDuration] = useState<number>(1);
  const [jalaliEndDate, setJalaliEndDate] = useState('');
  const [overrideEndDate, setOverrideEndDate] = useState(false);
  const [dateError, setDateError] = useState('');

  // Initial Sync
  useEffect(() => {
    const today = new Date();
    const todayJalali = formatJalali(today);

    if (campaign) {
      setUtmCampaign(campaign.utm_campaign);
      setChannel(campaign.channel || '');
      setSourceName(campaign.source_name || '');
      setNotes(campaign.notes || '');
      setTargetUrl(campaign.target_url || '');
      setCostToman(campaign.cost_irr ? Math.round(campaign.cost_irr / 10) : 0);

      const sDateObj = campaign.start_date ? new Date(campaign.start_date) : null;
      const eDateObj = campaign.end_date ? new Date(campaign.end_date) : null;

      if (sDateObj) {
        setJalaliStartDate(formatJalali(sDateObj));
        const formatHTime = format(sDateObj, 'HH:mm');
        setStartTime(formatHTime !== '00:00' ? formatHTime : '09:00');
      } else {
        setJalaliStartDate(todayJalali);
        setStartTime('09:00');
      }

      if (eDateObj) {
        setJalaliEndDate(formatJalali(eDateObj));
        const formatETime = format(eDateObj, 'HH:mm');
        setEndTime(formatETime !== '00:00' ? formatETime : '17:00');
      } else {
        setJalaliEndDate(todayJalali);
        setEndTime('17:00');
      }

      // Initialize scheduleType sensibly from note markers or default
      if (campaign.notes?.includes('[ساعتی]')) {
        setScheduleType('hourly');
      } else if (campaign.notes?.includes('[روزانه]')) {
        setScheduleType('daily');
      } else if (campaign.notes?.includes('[هفتگی]')) {
        setScheduleType('weekly');
      } else if (campaign.notes?.includes('[ماهانه]')) {
        setScheduleType('monthly');
      } else {
        // Fallback guess
        setScheduleType('hourly');
      }
      setOverrideEndDate(true); // Locked on edit mode to respect actual DB dates
    } else {
      setUtmCampaign('');
      setChannel('');
      setSourceName('');
      setCostToman(0);
      setNotes('');
      setTargetUrl('');

      setJalaliStartDate(todayJalali);
      setStartTime('09:00');
      setEndTime('17:00');
      setDuration(1);
      setScheduleType('hourly');
      setOverrideEndDate(false);
    }
    setDateError('');
  }, [campaign, isOpen]);

  // Auto-calculator triggers safely on dependency update
  useEffect(() => {
    if (overrideEndDate || !jalaliStartDate) return;

    const parsedStart = parseJalali(jalaliStartDate);
    if (!parsedStart) {
      setDateError('فرمت تاریخ شروع باید YYYY/MM/DD باشد');
      return;
    }
    setDateError('');

    let calculatedEndObj: Date | null = null;
    const count = Number(duration) || 1;

    if (scheduleType === 'hourly') {
      calculatedEndObj = parsedStart;
    } else if (scheduleType === 'daily') {
      calculatedEndObj = addDays(parsedStart, count);
    } else if (scheduleType === 'weekly') {
      calculatedEndObj = addWeeks(parsedStart, count);
    } else if (scheduleType === 'monthly') {
      calculatedEndObj = addMonths(parsedStart, count);
    }

    if (calculatedEndObj) {
      setJalaliEndDate(formatJalali(calculatedEndObj));
    }
  }, [scheduleType, jalaliStartDate, duration, overrideEndDate]);

  // Generate UTM Live Preview URL
  const generatedUtmUrl = React.useMemo(() => {
    if (!targetUrl.trim() || !utmCampaign.trim() || !channel.trim()) {
      return '';
    }
    const baseUrl = targetUrl.trim();
    const campaignVal = utmCampaign.trim();
    const channelVal = channel.trim();
    const sourceVal = sourceName.trim();

    try {
      const fullUrl = baseUrl.startsWith('http://') || baseUrl.startsWith('https://') 
        ? baseUrl 
        : `https://${baseUrl}`;
      
      const parsed = new URL(fullUrl);
      parsed.searchParams.set('utm_campaign', campaignVal);
      parsed.searchParams.set('utm_medium', channelVal);
      if (sourceVal) {
        parsed.searchParams.set('utm_source', sourceVal);
      }
      return parsed.toString();
    } catch {
      const connector = baseUrl.includes('?') ? '&' : '?';
      const sourceQuery = sourceVal ? `&utm_source=${encodeURIComponent(sourceVal)}` : '';
      return `${baseUrl}${connector}utm_campaign=${encodeURIComponent(campaignVal)}&utm_medium=${encodeURIComponent(channelVal)}${sourceQuery}`;
    }
  }, [targetUrl, utmCampaign, channel, sourceName]);

  const handleCopyLink = () => {
    if (!generatedUtmUrl) return;
    navigator.clipboard.writeText(generatedUtmUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!utmCampaign.trim() || !channel.trim() || !sourceName.trim()) {
      return;
    }

    const sDateObj = parseJalali(jalaliStartDate);
    const eDateObj = parseJalali(jalaliEndDate);

    if (!sDateObj || !eDateObj) {
      setDateError('لطفاً تاریخ‌های معتبری به فرمت سال/ماه/روز وارد کنید.');
      return;
    }

    try {
      setIsSubmitting(true);

      // Mix dates and times appropriately
      const finalStart = new Date(sDateObj);
      if (scheduleType === 'hourly' || scheduleType === 'daily') {
        const [sh, sm] = startTime.split(':').map(Number);
        finalStart.setHours(sh || 0, sm || 0, 0, 0);
      } else {
        finalStart.setHours(0, 0, 0, 0);
      }

      const finalEnd = new Date(eDateObj);
      if (scheduleType === 'hourly' || scheduleType === 'daily') {
        const [eh, em] = endTime.split(':').map(Number);
        finalEnd.setHours(eh || 0, em || 0, 0, 0);
      } else {
        finalEnd.setHours(23, 59, 59, 999);
      }

      // Prepend schedule metadata cleanly directly inside notes array marker
      const typeLabel = `[${SCHEDULING_TYPES.find(t => t.value === scheduleType)?.label.split(' ')[0] || ''}]`;
      const sterilizedNotes = notes.replace(/^\[.*?\]\s*/, '');
      const finalNotes = `${typeLabel} ${sterilizedNotes}`.trim();

      const payload = {
        utm_campaign: utmCampaign.trim(),
        channel: channel.trim(),
        source_name: sourceName.trim(),
        start_date: finalStart.toISOString(),
        end_date: finalEnd.toISOString(),
        cost_irr: costToman * 10, // Rial conversion
        currency: 'IRR',
        notes: finalNotes || null,
        target_url: targetUrl.trim() || null,
      };

      const success = await onSave(payload);
      if (success) {
        onClose();
      }
    } catch (err) {
      console.error(err);
      setDateError('خطایی در ذخیره اطلاعات رخ داد.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEditMode = !!campaign;

  return (
    <ModalWrapper
      id={id}
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'ویرایش جزئیات کمپین تبلیغاتی' : 'ایجاد کمپین تبلیغاتی جدید'}
      maxWidthClass="max-w-xl"
    >
      <form id={`${id}-form`} onSubmit={handleSubmit} className="flex flex-col max-h-[75vh] md:max-h-[80vh] text-right">
        {/* Scrollable Form Body Container */}
        <div className="flex-1 overflow-y-auto px-1 py-1 space-y-4 min-h-0 [scrollbar-width:thin] scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          {/* ۱. شناسه یو‌تی‌ام و منبع رسانه */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div id={`${id}-field-utm`}>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 flex items-center gap-1 justify-end">
                <span>شناسه کمپین یو‌تی‌ام (utm_campaign) *</span>
                <FileEdit className="w-3.5 h-3.5 text-brand-400" />
              </label>
              <input
                id={`${id}-input-utm`}
                type="text"
                required
                disabled={isEditMode}
                value={utmCampaign}
                onChange={(e) => setUtmCampaign(e.target.value)}
                placeholder="مثال: winter_sale_1405"
                className="w-full text-right px-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-brand-500 disabled:opacity-50 disabled:bg-slate-900/10 font-mono"
              />
            </div>

            <div id={`${id}-field-source`}>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 flex items-center gap-1 justify-end">
                <span>نام دقیق رسانه / پیج تبلیغاتی (utm_source) *</span>
                <Coins className="w-3.5 h-3.5 text-amber-400" />
              </label>
              <input
                id={`${id}-input-source`}
                type="text"
                required
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="مثال: code_yad_channel"
                className="w-full text-right px-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
          </div>

          {/* ۲. گرید آیکونی کانال‌ها */}
          <div id={`${id}-field-channel-selector`} className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 mb-1 flex items-center gap-1 justify-end">
              <span>کانال مارکتینگ (utm_medium) *</span>
              <Megaphone className="w-3.5 h-3.5 text-blue-400" />
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CHANNELS.map((item) => {
                const IconComponent = item.icon;
                const isSelected = channel === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setChannel(item.value)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-brand-500/15 border-brand-500 text-brand-400 font-bold shadow-sm shadow-brand-500/10'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-900/60 ' + item.color
                    }`}
                  >
                    <IconComponent className={`w-4 h-4 mb-1.5 ${isSelected ? 'text-brand-400' : 'text-slate-400'}`} />
                    <span className="text-[10px] font-medium leading-none">{item.label}</span>
                  </button>
                );
              })}
            </div>
            <input
              id={`${id}-input-channel`}
              type="text"
              required
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder="یا کانال اختصاصی خود را در اینجا بنویسید..."
              className="w-full text-right px-4 py-2 bg-slate-950/30 border border-slate-800 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-brand-500 mt-2"
            />
          </div>

          {/* ۳. بخش پیشرفته زمانبندی شمسی */}
          <div id={`${id}-scheduling-section`} className="p-4 bg-slate-950/40 border border-slate-800/80 rounded-2xl space-y-4">
            <div className="border-b border-slate-900 pb-2 flex items-center justify-between">
              <span className="text-[10px] text-slate-500 font-bold">Jalali Standard Scheduler</span>
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                <span>زمان‌بندی و دوره کمپین</span>
                <Clock className="w-4 h-4 text-brand-400" />
              </span>
            </div>

            {/* تب‌های انتخاب نوع زمان‌بندی */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-950/60 rounded-xl border border-slate-900">
              {SCHEDULING_TYPES.map((t) => {
                const Icon = t.icon;
                const isSelected = scheduleType === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      setScheduleType(t.value as any);
                      setOverrideEndDate(false);
                    }}
                    className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-brand-500 text-white font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.label.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>

            {dateError && (
              <p className="text-xs text-red-400 bg-red-400/5 py-1 px-2.5 rounded-lg border border-red-500/10 text-center font-bold">
                {dateError}
              </p>
            )}

            {/* فرمول‌های پویای زمان‌بندی */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* فیلد اول: تاریخ شروع شمسی */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">تاریخ شروع شمسی</label>
                <input
                  type="text"
                  required
                  value={jalaliStartDate}
                  onChange={(e) => setJalaliStartDate(toEnglishDigits(e.target.value))}
                  placeholder="۱۴۰۵/۰۳/۲۴"
                  className="w-full text-center px-4 py-2 bg-slate-950/50 border border-slate-800 rounded-xl text-slate-100 text-sm font-mono focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* فیلد دوم بر اساس نوع: تکرار یا بازه‌ زمانی */}
              {scheduleType !== 'hourly' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    {scheduleType === 'daily' && 'مدت دوره (تعداد روز)'}
                    {scheduleType === 'weekly' && 'مدت دوره (تعداد هفته)'}
                    {scheduleType === 'monthly' && 'مدت دوره (تعداد ماه)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={duration}
                    onChange={(e) => setDuration(Math.max(1, Number(e.target.value)))}
                    className="w-full text-center px-4 py-2 bg-slate-950/50 border border-slate-800 rounded-xl text-slate-100 text-sm font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>
              )}
            </div>

            {/* فیلدهای ساعت برای حالت‌های ساعتی و روزانه */}
            {(scheduleType === 'hourly' || scheduleType === 'daily') && (
              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-950/30 border border-slate-900 rounded-xl">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1 text-center">ساعت پایان</label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full text-center px-2 py-1 bg-slate-950/50 border border-slate-850 rounded-lg text-slate-200 text-xs font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1 text-center">ساعت شروع</label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full text-center px-2 py-1 bg-slate-950/50 border border-slate-850 rounded-lg text-slate-200 text-xs font-mono focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* فیلد تاریخ پایان (محاسبه خودکار همراه با اورراید دستی) */}
            <div className="p-3 bg-slate-950/50 border border-slate-855 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOverrideEndDate(!overrideEndDate)}
                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                    overrideEndDate 
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                      : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                  title="تغییر دستی تاریخ پایان"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                
                <input
                  type="text"
                  disabled={!overrideEndDate}
                  value={jalaliEndDate}
                  onChange={(e) => setJalaliEndDate(toEnglishDigits(e.target.value))}
                  placeholder="۱۴۰۵/۰۳/۲۴"
                  className="w-28 text-center px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs font-mono focus:outline-none focus:border-brand-500 disabled:opacity-50"
                />
              </div>
              
              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 pb-1">
                <span>تاریخ پایان کمپین</span>
                <span className={`w-1.5 h-1.5 rounded-full ${overrideEndDate ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
              </span>
            </div>
          </div>

          {/* ۴. لینک پایه (Base URL) */}
          <div id={`${id}-field-target-url`}>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 flex items-center gap-1 justify-end">
              <span>لینک پایه لندینگ / وبسایت (Base URL)</span>
              <Link className="w-3.5 h-3.5 text-purple-400" />
            </label>
            <input
              id={`${id}-input-target-url`}
              type="text"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://yoursite.com/register"
              className="w-full text-left px-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-brand-500 font-mono"
            />
          </div>

          {/* ۵. کارت گرافیکی موتور تولید یو‌تی‌ام هوشمند */}
          {generatedUtmUrl && (
            <div id={`${id}-utm-generator-card`} className="p-3.5 bg-slate-950/60 border border-dashed border-brand-500/30 rounded-2xl space-y-2 text-right relative overflow-hidden transition-all">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 rounded-full blur-2xl -z-10 pointer-events-none" />
              
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/20 hover:border-brand-500/40 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>کپی شد</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>کپی لینک UTM</span>
                    </>
                  )}
                </button>
                <span className="text-[11px] font-bold text-brand-400 flex items-center gap-1.5">
                  <span>لینک نهایی با پارامترهای UTM</span>
                  <Globe className="w-3.5 h-3.5" />
                </span>
              </div>

              <p className="dir-ltr text-left text-xs bg-slate-950/80 p-2.5 rounded-xl border border-slate-900/80 font-mono text-slate-300 break-all select-all leading-relaxed max-h-20 overflow-y-auto">
                {generatedUtmUrl}
              </p>
            </div>
          )}

          {/* ۶. هزینه کل کمپین و یادداشت‌ها */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div id={`${id}-field-cost`}>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 flex items-center gap-1 justify-end">
                <span>هزینه کل کمپین (تومان)</span>
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
              </label>
              <div className="relative">
                <input
                  id={`${id}-input-cost`}
                  type="number"
                  min="0"
                  value={costToman || ''}
                  onChange={(e) => setCostToman(Number(e.target.value))}
                  placeholder="۰"
                  className="w-full text-right pl-14 pr-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl text-slate-100 text-sm font-mono focus:outline-none focus:border-brand-500"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-bold pointer-events-none">تومان</span>
              </div>
            </div>

            <div id={`${id}-field-notes`}>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 flex items-center gap-1 justify-end">
                <span>یادداشت‌ها</span>
                <FileText className="w-3.5 h-3.5 text-slate-500" />
              </label>
              <input
                id={`${id}-input-notes`}
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="توضیحات اختیاری کمپین تبلیغاتی..."
                className="w-full text-right px-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Buttons - Sticky Footer */}
        <div id={`${id}-actions`} className="sticky bottom-0 bg-slate-900 flex items-center justify-end space-x-3 space-x-reverse pt-4 border-t border-slate-800 shrink-0 z-10">
          <button
            id={`${id}-cancel-btn`}
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-755 text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            انصراف
          </button>
          <button
            id={`${id}-submit-btn`}
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-lg shadow-brand-500/15 transition-colors cursor-pointer"
          >
            {isSubmitting ? 'در حال ذخیره...' : 'ذخیره کمپین'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
};
