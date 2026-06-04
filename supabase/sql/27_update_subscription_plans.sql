-- Update plans references to include the 4 new packages and transition accounts safely

-- 1. Insert or update the 4 new subscription plans with the correct pricing and quotas
INSERT INTO public.plans (plan_code, display_name, price_irr, monthly_quota, period_days, ai_model)
VALUES 
    ('free', 'رایگان', 0, 30, 3, 'gemini-3.1-flash-lite'),
    ('starter', 'استارتر', 990000, 300, 30, 'gemini-3.1-flash-lite'),
    ('plus', 'پلاس', 1990000, 700, 30, 'gemini-3.1-flash-lite'),
    ('pro', 'پرو', 3690000, 1300, 30, 'gemini-3.1-flash-lite')
ON CONFLICT (plan_code) 
DO UPDATE SET 
    display_name = EXCLUDED.display_name,
    price_irr = EXCLUDED.price_irr,
    monthly_quota = EXCLUDED.monthly_quota,
    period_days = EXCLUDED.period_days,
    ai_model = EXCLUDED.ai_model;

-- 2. Downgrade/Hard Reset existing active subscriptions to the 'free' plan safely
UPDATE public.subscriptions
SET 
    plan_code = 'free',
    started_at = now(),
    expires_at = now() + INTERVAL '3 days',
    updated_at = now();

-- 3. Reset existing usage counters for all users to match the 'free' trial limit period
UPDATE public.usage_counters
SET
    period_start = now(),
    period_end = now() + INTERVAL '3 days',
    request_count = 0,
    updated_at = now();

-- 4. Notify listener channel
NOTIFY pgrst, 'reload schema';
