-- supabase/sql/25_seed_missing_plans.sql
-- Seed missing/updated plans into public.plans securely with ON CONFLICT resolution

INSERT INTO public.plans (plan_code, display_name, price_irr, monthly_quota, period_days, ai_model)
VALUES 
    ('free', 'آزمایشی', 0, 30, 3, 'gemini-2.5-flash-lite'),
    ('plus', 'پلاس', 990000, 400, 30, 'gemini-2.5-flash-lite'),
    ('pro', 'پرو', 2990000, 1000, 30, 'gemini-2.5-flash-lite')
ON CONFLICT (plan_code) 
DO UPDATE SET 
    display_name = EXCLUDED.display_name,
    price_irr = EXCLUDED.price_irr,
    monthly_quota = EXCLUDED.monthly_quota,
    period_days = EXCLUDED.period_days,
    ai_model = EXCLUDED.ai_model;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
