import {
  Profile,
  Subscription,
  Payment,
  DiscountCode,
  Plan,
  SupportTicket,
  TrafficOverview,
  FunnelStageRow,
  PurchaseTimingRow,
  RetentionRow,
  ChannelRoiRow,
  CampaignSummary,
  CampaignDetail
} from './supabase';
import toast from 'react-hot-toast';

const ADMIN_SECRET = '3128';

// هاردکد شده با تأیید مالک پنل (تک‌کاربره): گیت‌وی سوپابیس برای Edge Function
// با verify_jwt=true هدرهای apikey و Authorization را اجباری می‌کند.
const SUPABASE_URL =
  (import.meta as any).env.VITE_SUPABASE_URL || 'https://rvgiidesehuaqqncqilu.supabase.co';
const SUPABASE_ANON_KEY =
  (import.meta as any).env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2Z2lpZGVzZWh1YXFxbmNxaWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNTc0NDQsImV4cCI6MjA5NTYzMzQ0NH0.Ko5juJCP76hDXMWIKsvv1AIQlyTztH0Zh0m1KN1gPSo';

class DataService {
  private async request(action: string, payload: any = {}): Promise<any> {
    const baseUrl = SUPABASE_URL;
    const response = await fetch(`${baseUrl}/functions/v1/admin-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'x-admin-secret': ADMIN_SECRET,
      },
      body: JSON.stringify({ action, ...payload }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const errMsg = errBody.error || `خطا در اجرای عملیات ${action}`;
      throw new Error(errMsg);
    }

    const result = await response.json();
    return result;
  }

  // Fetch profiles
  async getProfiles(): Promise<Profile[]> {
    try {
      const data = await this.request('list_profiles');
      return (data || []) as Profile[];
    } catch (error) {
      console.error('Error fetching profiles:', error);
      throw error;
    }
  }

  // Update profile block or details
  async updateProfile(profile: Profile): Promise<boolean> {
    try {
      await this.request('update_profile', {
        id: profile.id,
        display_name: profile.display_name,
        is_blocked: profile.is_blocked
      });
      toast.success('پروفایل با موفقیت در پایگاه داده ذخیره شد.');
      return true;
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'خطا در ثبت اطلاعات پروفایل');
      throw error;
    }
  }

  // Fetch plans
  async getPlans(): Promise<Plan[]> {
    try {
      const data = await this.request('list_plans');
      return (data || []) as Plan[];
    } catch (error) {
      console.error('Error fetching plans:', error);
      throw error;
    }
  }

  // Fetch subscriptions
  async getSubscriptions(): Promise<Subscription[]> {
    try {
      const data = await this.request('list_subscriptions');
      return (data || []) as Subscription[];
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      throw error;
    }
  }

  // Change/upsert Subscription for user
  async saveSubscription(subscription: Subscription): Promise<boolean> {
    try {
      await this.request('upsert_subscription', {
        id: subscription.id,
        user_id: subscription.user_id,
        plan_id: subscription.plan_id,
        status: subscription.status,
        expires_at: subscription.expires_at,
        created_at: subscription.created_at
      });
      toast.success('اشتراک با موفقیت در پایگاه داده ثبت شد.');
      return true;
    } catch (error: any) {
      console.error('Error saving subscription:', error);
      toast.error(error.message || 'خطا در ثبت اطلاعات اشتراک');
      throw error;
    }
  }

  // Fetch payments
  async getPayments(): Promise<Payment[]> {
    try {
      const data = await this.request('list_payments');
      return (data || []) as Payment[];
    } catch (error) {
      console.error('Error fetching payments:', error);
      throw error;
    }
  }

  // Fetch pending manual card-to-card payments
  async getManualPayments(): Promise<Payment[]> {
    try {
      const data = await this.request('list_manual_payments');
      return (data || []) as Payment[];
    } catch (error) {
      console.error('Error fetching manual payments:', error);
      throw error;
    }
  }

  // Approve a manual payment
  async approveManualPayment(paymentId: string): Promise<boolean> {
    try {
      await this.request('approve_manual_payment', { payment_id: paymentId });
      toast.success('پرداخت با موفقیت تایید و اشتراک فعال گردید.');
      return true;
    } catch (error: any) {
      console.error('خطا در تایید تراکنش دستی:', error);
      toast.error(error.message || 'خطا در تایید تراکنش وجود دارد.');
      throw error;
    }
  }

  // Reject a manual payment with reason
  async rejectManualPayment(paymentId: string, reason: string): Promise<boolean> {
    try {
      await this.request('reject_manual_payment', { payment_id: paymentId, reason });
      toast.success('فیش تراکنش با موفقیت رد و کوپن احتمالی آزاد شد.');
      return true;
    } catch (error: any) {
      console.error('خطا در رد تراکنش:', error);
      toast.error(error.message || 'خطا در ثبت رد تراکنش وجود دارد.');
      throw error;
    }
  }

  // Fetch discount codes
  async getDiscountCodes(): Promise<DiscountCode[]> {
    try {
      const data = await this.request('list_discounts');
      return (data || []) as DiscountCode[];
    } catch (error) {
      console.error('Error fetching discount codes:', error);
      throw error;
    }
  }

  // Upsert/Create discount codes
  async saveDiscountCode(discount: DiscountCode): Promise<boolean> {
    try {
      await this.request('save_discount', discount);
      toast.success('کد تخفیف با موفقیت در پایگاه داده درج شد.');
      return true;
    } catch (error: any) {
      console.error('Error saving discount code:', error);
      toast.error(error.message || 'خطا در ثبت کد تخفیف');
      throw error;
    }
  }

  // Delete discount code
  async deleteDiscountCode(id: string): Promise<boolean> {
    try {
      await this.request('delete_discount', { id });
      toast.success('کد تخفیف با موفقیت از پایگاه داده حذف شد.');
      return true;
    } catch (error: any) {
      console.error('Error deleting discount code:', error);
      toast.error(error.message || 'خطا در حذف کد تخفیف');
      throw error;
    }
  }

  // Fetch Telegram notification settings
  async getTelegramSettings(): Promise<{ bot_token?: string; chat_id?: string; is_enabled?: boolean } | null> {
    try {
      const data = await this.request('get_telegram_settings');
      return data;
    } catch (error) {
      console.error('Error fetching telegram settings:', error);
      return null;
    }
  }

  // Update Telegram notification settings
  async saveTelegramSettings(settings: { bot_token: string; chat_id: string; is_enabled: boolean }): Promise<boolean> {
    try {
      await this.request('save_telegram_settings', settings);
      return true;
    } catch (error: any) {
      console.error('Error saving telegram settings:', error);
      throw error;
    }
  }

  // Fetch support tickets
  async getTickets(): Promise<SupportTicket[]> {
    try {
      const data = await this.request('list_tickets');
      return (data || []) as SupportTicket[];
    } catch (error) {
      console.error('Error fetching support tickets:', error);
      throw error;
    }
  }

  // Get Marketing Traffic Overview
  async getMarketingTraffic(): Promise<TrafficOverview[]> {
    try {
      const data = await this.request('marketing_traffic');
      return (data || []) as TrafficOverview[];
    } catch (error: any) {
      console.error('Error fetching marketing traffic:', error);
      toast.error(error.message || 'خطا در دریافت آمار ترافیک مارکتینگ');
      throw error;
    }
  }

  // Get Marketing Funnel Analysis
  async getMarketingFunnel(channel?: string): Promise<FunnelStageRow[]> {
    try {
      const data = await this.request('marketing_funnel', { channel });
      return (data || []) as FunnelStageRow[];
    } catch (error: any) {
      console.error('Error fetching marketing funnel:', error);
      toast.error(error.message || 'خطا در دریافت قیف تحلیل مارکتینگ');
      throw error;
    }
  }

  // Get Marketing Purchase Timing distribution
  async getMarketingPurchaseTiming(channel?: string): Promise<PurchaseTimingRow[]> {
    try {
      const data = await this.request('marketing_purchase_timing', { channel });
      return (data || []) as PurchaseTimingRow[];
    } catch (error: any) {
      console.error('Error fetching purchase timing:', error);
      toast.error(error.message || 'خطا در دریافت زمان‌بندی خریدهای مارکتینگ');
      throw error;
    }
  }

  // Get Marketing Retention Cohort Analysis
  async getMarketingRetention(): Promise<RetentionRow[]> {
    try {
      const data = await this.request('marketing_retention');
      return (data || []) as RetentionRow[];
    } catch (error: any) {
      console.error('Error fetching marketing retention:', error);
      toast.error(error.message || 'خطا در دریافت ماندگاری کاربران مارکتینگ');
      throw error;
    }
  }

  // Get Marketing Channel ROI Analysis
  async getMarketingRoi(): Promise<ChannelRoiRow[]> {
    try {
      const data = await this.request('marketing_roi');
      return (data || []) as ChannelRoiRow[];
    } catch (error: any) {
      console.error('Error fetching marketing ROI:', error);
      toast.error(error.message || 'خطا در دریافت تحلیل نرخ بازگشت سرمایه');
      throw error;
    }
  }

  // Get Marketing Campaigns
  async getMarketingCampaigns(): Promise<CampaignSummary[]> {
    try {
      const data = await this.request('marketing_campaigns');
      return (data || []) as CampaignSummary[];
    } catch (error: any) {
      console.error('Error fetching marketing campaigns:', error);
      toast.error(error.message || 'خطا در دریافت لیست کمپین‌ها');
      throw error;
    }
  }

  // Get Marketing Campaign Detail
  async getMarketingCampaignDetail(utmCampaign: string): Promise<CampaignDetail | null> {
    try {
      const data = await this.request('marketing_campaign_detail', { utm_campaign: utmCampaign });
      if (!data) return null;
      return sanitizeCampaignDetail(data);
    } catch (error: any) {
      console.error('Error fetching marketing campaign detail:', error);
      toast.error(error.message || 'خطا در دریافت جزئیات عملکرد کمپین');
      throw error;
    }
  }

  // Save/Upsert marketing campaign
  async saveMarketingCampaign(payload: any): Promise<boolean> {
    try {
      await this.request('marketing_save_campaign', payload);
      toast.success('کمپین با موفقیت در پایگاه داده ذخیره شد.');
      return true;
    } catch (error: any) {
      console.error('Error saving marketing campaign:', error);
      toast.error(error.message || 'خطا در ثبت اطلاعات کمپین');
      throw error;
    }
  }
}

// Client-side Sanitizer middleware for Campaign details
export function sanitizeCampaignDetail(detail: any): CampaignDetail {
  if (!detail) {
    return {
      utm_campaign: '',
      channel: '',
      visitors: 0,
      registrations: 0,
      buyers: 0,
      conversion_rate: 0,
      total_cost: 0,
      cac: 0,
      revenue: 0,
      roi: 0,
    };
  }
  return {
    utm_campaign: detail.utm_campaign || '',
    channel: detail.channel || '',
    visitors: Number(detail.visitors ?? 0),
    registrations: Number(detail.registrations ?? 0),
    buyers: Number(detail.buyers ?? 0),
    conversion_rate: Number(detail.conversion_rate ?? 0),
    total_cost: Number(detail.total_cost ?? 0),
    cac: Number(detail.cac ?? 0),
    revenue: Number(detail.revenue ?? 0),
    roi: Number(detail.roi ?? 0),
  };
}

export const dataStore = new DataService();
