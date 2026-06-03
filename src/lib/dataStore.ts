import { Profile, Subscription, Payment, DiscountCode, Plan, supabase } from './supabase';
import toast from 'react-hot-toast';

const ADMIN_SECRET = '3128';

class DataService {
  private async request(action: string, payload: any = {}): Promise<any> {
    const { data, error } = await supabase.functions.invoke('admin-api', {
      body: { action, ...payload },
      headers: {
        'x-admin-secret': ADMIN_SECRET,
      }
    });

    if (error) {
      console.error(`Gateway native invoke error on action ${action}:`, error);
      throw error;
    }

    return data;
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
    } catch (error) {
      console.error('Error updating profile:', error);
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
    } catch (error) {
      console.error('Error saving subscription:', error);
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
    } catch (error) {
      console.error('Error saving discount code:', error);
      throw error;
    }
  }

  // Delete discount code
  async deleteDiscountCode(id: string): Promise<boolean> {
    try {
      await this.request('delete_discount', { id });
      toast.success('کد تخفیف با موفقیت از پایگاه داده حذف شد.');
      return true;
    } catch (error) {
      console.error('Error deleting discount code:', error);
      throw error;
    }
  }
}

export const dataStore = new DataService();
