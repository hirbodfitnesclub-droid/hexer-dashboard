-- 12_rls.sql
-- Safety fallback net: Ensures RLS is enabled and correctly configured on all tables

-- 1. Enable Row Level Security (RLS) on all client tables
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ai_requests_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.habit_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reminders ENABLE ROW LEVEL SECURITY;

-- 2. Re-assert and re-build RLS policies to make sure everything matches (Idempotent: Drop before Create)

-- Profiles Table Policy
DROP POLICY IF EXISTS "Users can manage their own profiles" ON public.profiles;
CREATE POLICY "Users can manage their own profiles"
    ON public.profiles
    FOR ALL
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Subscriptions Table Policy
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view their own subscriptions"
    ON public.subscriptions
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Usage Counters Table Policy
DROP POLICY IF EXISTS "Users can view their own usage counters" ON public.usage_counters;
CREATE POLICY "Users can view their own usage counters"
    ON public.usage_counters
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- AI Requests Log Table Policy
DROP POLICY IF EXISTS "Users can view their own ai requests log" ON public.ai_requests_log;
CREATE POLICY "Users can view their own ai requests log"
    ON public.ai_requests_log
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Projects Table Policy
DROP POLICY IF EXISTS "Users can manage their own projects" ON public.projects;
CREATE POLICY "Users can manage their own projects"
    ON public.projects
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Tasks Table Policy
DROP POLICY IF EXISTS "Users can manage their own tasks" ON public.tasks;
CREATE POLICY "Users can manage their own tasks"
    ON public.tasks
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Notes Table Policy
DROP POLICY IF EXISTS "Users can manage their own notes" ON public.notes;
CREATE POLICY "Users can manage their own notes"
    ON public.notes
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Habits Table Policy
DROP POLICY IF EXISTS "Users can manage their own habits" ON public.habits;
CREATE POLICY "Users can manage their own habits"
    ON public.habits
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Habit Completions Table Policy
DROP POLICY IF EXISTS "Users can manage their own habit completions" ON public.habit_completions;
CREATE POLICY "Users can manage their own habit completions"
    ON public.habit_completions
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Media Assets Table Policy
DROP POLICY IF EXISTS "Users can manage their own media assets" ON public.media_assets;
CREATE POLICY "Users can manage their own media assets"
    ON public.media_assets
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Payments Table Policy (Defensive SELECT ONLY for client application access)
DROP POLICY IF EXISTS "Users can only view their own payments" ON public.payments;
CREATE POLICY "Users can only view their own payments"
    ON public.payments
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Reminders Table Policy
DROP POLICY IF EXISTS "Users can manage their own reminders" ON public.reminders;
CREATE POLICY "Users can manage their own reminders"
    ON public.reminders
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
