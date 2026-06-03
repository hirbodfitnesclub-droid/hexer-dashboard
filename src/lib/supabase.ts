// Any needed supabase client-side library import
import { createClient } from '@supabase/supabase-js';

// Helper types matching the database schema and Gateway DTO outputs
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
  name: string;
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
  id?: string; // اختیاری کردن شناسه در فرانت برای پاس دادن وظیفه تولید شناسه به دیتابیس
  code: string;
  discount_percent: number;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

// Client-side publishable initialize
const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL || 'https://rvgiidesehuaqqncqilu.supabase.co';
const SUPABASE_ANON_KEY = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


