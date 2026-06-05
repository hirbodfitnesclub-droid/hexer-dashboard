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
  status: 'success' | 'failed' | 'pending' | 'pending_manual';
  coupon_code?: string | null;
  receipt_signed_url?: string | null;
  manual_decline_reason?: string | null;
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

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: 'open' | 'pending' | 'resolved' | 'closed' | string;
  created_at: string;
  profiles: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    created_at: string;
  } | null;
  email: string;
}
