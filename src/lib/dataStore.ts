import { Profile, Subscription, Payment, DiscountCode, Plan } from './supabase';
import toast from 'react-hot-toast';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || 'https://rvgiidesehuaqqncqilu.supabase.co';
const supabaseKey = 'sb_secret_Pm6SKlUwTnaRCRlO1GTgzg_NjFpnkLb';

class DataService {
  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const url = `${supabaseUrl}/rest/v1/${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`REST Request error on ${path}:`, errText);
      throw new Error(errText || response.statusText);
    }

    if (response.status === 204) {
      return null;
    }

    return await response.json();
  }

  // Fetch profiles
  async getProfiles(): Promise<Profile[]> {
    try {
      const data = await this.request('profiles?select=*&order=created_at.desc');
      return (data || []) as Profile[];
    } catch (error) {
      console.error('Error fetching profiles:', error);
      throw error;
    }
  }

  // Update profile block or details
  async updateProfile(profile: Profile): Promise<boolean> {
    try {
      await this.request(`profiles?id=eq.${profile.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          display_name: profile.display_name,
          is_blocked: profile.is_blocked
        })
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
      const data = await this.request('plans?select=*');
      return (data || []).map((p: any) => ({
        id: p.plan_code,
        name: p.display_name,
        price: Number(p.price_irr),
        ai_tokens_limit: p.monthly_quota
      })) as Plan[];
    } catch (error) {
      console.error('Error fetching plans:', error);
      throw error;
    }
  }

  // Fetch subscriptions with client-side joins to bypass PGRST200
  async getSubscriptions(): Promise<Subscription[]> {
    try {
      // 1. Fetch subscriptions
      const subs = await this.request('subscriptions?select=*&order=started_at.desc');
      
      // 2. Fetch profiles
      const profiles = await this.request('profiles?select=*');

      // 3. Fetch plans
      const plans = await this.getPlans();

      // 4. Perform client-side join
      const joinedSubscriptions = (subs || []).map((sub: any) => {
        const foundProfile = (profiles || []).find((p: any) => p.id === sub.user_id) || {
          id: sub.user_id,
          display_name: 'کاربر ناشناس',
          avatar_url: null,
          created_at: sub.started_at
        };
        
        const planCode = sub.plan_code;
        const foundPlan = plans.find(p => p.id === planCode) || {
          id: planCode,
          name: 'نامشخص',
          price: 0,
          ai_tokens_limit: 0
        };

        return {
          id: sub.id,
          user_id: sub.user_id,
          plan_id: planCode,
          status: sub.status,
          expires_at: sub.expires_at,
          created_at: sub.started_at,
          profiles: foundProfile,
          plans: foundPlan
        };
      });

      return joinedSubscriptions as Subscription[];
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      throw error;
    }
  }

  // Change/upsert Subscription for user
  async saveSubscription(subscription: Subscription): Promise<boolean> {
    try {
      await this.request('subscriptions', {
        method: 'POST',
        headers: {
          'Prefer': 'resolution=merge-duplicates, return=representation'
        },
        body: JSON.stringify({
          id: subscription.id,
          user_id: subscription.user_id,
          plan_code: subscription.plan_id,
          status: subscription.status,
          expires_at: subscription.expires_at,
          started_at: subscription.created_at
        })
      });
      toast.success('اشتراک با موفقیت در پایگاه داده ثبت شد.');
      return true;
    } catch (error) {
      console.error('Error saving subscription:', error);
      throw error;
    }
  }

  // Fetch payments with client-side join to bypass PGRST200
  async getPayments(): Promise<Payment[]> {
    try {
      // 1. Fetch payments
      const payments = await this.request('payments?select=*&order=created_at.desc');

      // 2. Fetch profiles
      const profiles = await this.request('profiles?select=*');

      // 3. Perform client-side join
      const joinedPayments = (payments || []).map((pay: any) => {
        const foundProfile = (profiles || []).find((p: any) => p.id === pay.user_id) || {
          id: pay.user_id,
          display_name: 'کاربر ناشناس',
          avatar_url: null,
          created_at: pay.created_at
        };

        return {
          ...pay,
          profiles: foundProfile
        };
      });

      return joinedPayments as Payment[];
    } catch (error) {
      console.error('Error fetching payments:', error);
      throw error;
    }
  }

  // Fetch discount codes
  async getDiscountCodes(): Promise<DiscountCode[]> {
    try {
      const data = await this.request('discount_codes?select=*&order=created_at.desc');
      return (data || []) as DiscountCode[];
    } catch (error) {
      console.error('Error fetching discount codes:', error);
      throw error;
    }
  }

  // Upsert/Create discount codes
  async saveDiscountCode(discount: DiscountCode): Promise<boolean> {
    try {
      await this.request('discount_codes', {
        method: 'POST',
        headers: {
          'Prefer': 'resolution=merge-duplicates, return=representation'
        },
        body: JSON.stringify({
          id: discount.id,
          code: discount.code.toUpperCase(),
          discount_percent: discount.discount_percent,
          max_uses: discount.max_uses,
          used_count: discount.used_count,
          expires_at: discount.expires_at,
          is_active: discount.is_active,
          created_at: discount.created_at
        })
      });
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
      await this.request(`discount_codes?id=eq.${id}`, {
        method: 'DELETE'
      });
      toast.success('کد تخفیف با موفقیت از پایگاه داده حذف شد.');
      return true;
    } catch (error) {
      console.error('Error deleting discount code:', error);
      throw error;
    }
  }
}

export const dataStore = new DataService();
