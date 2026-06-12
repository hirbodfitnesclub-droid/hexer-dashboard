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

export interface TrafficOverview {
  landing_host: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  uniques_today: number;
  uniques_7d: number;
  uniques_30d: number;
  page_views_30d: number;
  cta_start_free_clicks_30d: number;
  cta_login_clicks_30d: number;
}

export interface FunnelStageRow {
  channel: string;
  stage: string;
  count: number;
  conversion_percentage: number;
}

export interface PurchaseTimingRow {
  channel: string;
  timing_category: 'never_purchased' | 'at_registration' | 'during_free_trial' | 'after_trial' | string;
  user_count: number;
}

export interface RetentionRow {
  channel: string;
  total_users: number;
  retained_m1: number;
  retention_rate_m1: number;
  retained_m2: number;
  retention_rate_m2: number;
  retained_m3: number;
  retention_rate_m3: number;
  retained_m6: number;
  retention_rate_m6: number;
}

export interface ChannelRoiRow {
  channel: string;
  visitors: number;
  registrations: number;
  buyers: number;
  conversion_rate: number;
  total_cost: number;
  cac: number;
  revenue: number;
  roi: number;
}

export interface CampaignSummary {
  utm_campaign: string;
  channel: string;
  source_name: string | null;
  start_date: string | null;
  end_date: string | null;
  cost_irr: number;
  currency: string;
  notes: string | null;
  target_url?: string | null;
  created_at: string;
}

export interface CampaignDetail {
  utm_campaign: string;
  channel: string;
  visitors: number;
  registrations: number;
  buyers: number;
  conversion_rate: number;
  total_cost: number;
  cac: number;
  revenue: number;
  roi: number;
}

