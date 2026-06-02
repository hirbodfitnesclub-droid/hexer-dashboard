-- 02_billing.sql
-- Create billing and subscription management tables and registration trigger

-- 1. Plans reference table
CREATE TABLE IF NOT EXISTS public.plans (
    plan_code TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    price_irr BIGINT NOT NULL,
    monthly_quota INTEGER NOT NULL,
    period_days INTEGER NOT NULL,
    ai_model TEXT NOT NULL
);

-- Seed Plans Data (Idempotent: INSERT .. ON CONFLICT)
INSERT INTO public.plans (plan_code, display_name, price_irr, monthly_quota, period_days, ai_model)
VALUES 
    ('free', 'آزمایشی', 0, 30, 3, 'gemini-2.5-flash-lite'),
    ('plus', 'پلاس', 990000, 400, 30, 'gemini-2.5-flash-lite'),
    ('pro', 'پرو', 2990000, 1000, 30, 'gemini-3.1-flash-lite')
ON CONFLICT (plan_code) 
DO UPDATE SET 
    display_name = EXCLUDED.display_name,
    price_irr = EXCLUDED.price_irr,
    monthly_quota = EXCLUDED.monthly_quota,
    period_days = EXCLUDED.period_days,
    ai_model = EXCLUDED.ai_model;

-- 2. Subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_code TEXT NOT NULL REFERENCES public.plans(plan_code),
    status TEXT NOT NULL DEFAULT 'active',
    started_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Usage Counters table
CREATE TABLE IF NOT EXISTS public.usage_counters (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    period_end TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. AI Requests Log table
CREATE TABLE IF NOT EXISTS public.ai_requests_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mode TEXT NOT NULL,
    model TEXT NOT NULL,
    tokens_estimate INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Enable Row Level Security (RLS) on all three tables
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_requests_log ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies for user records (Idempotent: drop before create)
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view their own subscriptions"
    ON public.subscriptions
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own usage counters" ON public.usage_counters;
CREATE POLICY "Users can view their own usage counters"
    ON public.usage_counters
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own ai requests log" ON public.ai_requests_log;
CREATE POLICY "Users can view their own ai requests log"
    ON public.ai_requests_log
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- 7. Define Registration Trigger Function (handle_new_user)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Insert Profile
    INSERT INTO public.profiles (id, full_name, avatar_url, timezone, onboarding_completed, created_at, updated_at)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
        COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
        'Asia/Tehran',
        false,
        now(),
        now()
    )
    ON CONFLICT (id) DO NOTHING;

    -- 2. Insert Subscription (3 Days trial on 'free' plan)
    INSERT INTO public.subscriptions (id, user_id, plan_code, status, started_at, expires_at, updated_at)
    VALUES (
        gen_random_uuid(),
        new.id,
        'free',
        'active',
        now(),
        now() + interval '3 days',
        now()
    )
    ON CONFLICT (user_id) DO NOTHING;

    -- 3. Insert Usage Counter
    INSERT INTO public.usage_counters (user_id, period_start, period_end, request_count, updated_at)
    VALUES (
        new.id,
        now(),
        now() + interval '3 days',
        0,
        now()
    )
    ON CONFLICT (user_id) DO NOTHING;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Bind trigger to auth.users (Idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
