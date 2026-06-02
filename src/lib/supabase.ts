import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || 'https://rvgiidesehuaqqncqilu.supabase.co';
// Using the provided service role / bypass key for administrative dashboard operations
const supabaseServiceKey = 'sb_secret_Pm6SKlUwTnaRCRlO1GTgzg_NjFpnkLb';

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Helper types matching the database schema
export interface Profile {
  id: string;
  email?: string;
  display_name: string | null;
  avatar_url: string | null;
  is_blocked?: boolean;
  created_at: string;
}

export interface Plan {
  id: string;
  name: string; // e.g. "Free", "Pro", "Enterprise"
  price: number;
  ai_tokens_limit: number;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'active' | 'expired' | 'canceled';
  expires_at: string | null;
  created_at: string;
  // Included fields via join
  profiles?: Profile;
  plans?: Plan;
}

export interface Payment {
  id: string;
  user_id: string;
  amount: number;
  status: 'success' | 'failed' | 'pending';
  coupon_code?: string | null;
  created_at: string;
  profiles?: Profile;
}

export interface DiscountCode {
  id: string;
  code: string;
  discount_percent: number;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}
