import { Profile, Subscription, Payment, DiscountCode, Plan, SupportTicket } from './supabase';
import toast from 'react-hot-toast';

const ADMIN_SECRET = '3128';

class DataService {
  private async request(action: string, payload: any = {}): Promise<any> {
    const baseUrl = (import.meta as any).env.VITE_SUPABASE_URL || 'https://rvgiidesehuaqqncqilu.supabase.co';
    const response = await fetch(`${baseUrl}/functions/v1/admin-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
}

export const dataStore = new DataService();
