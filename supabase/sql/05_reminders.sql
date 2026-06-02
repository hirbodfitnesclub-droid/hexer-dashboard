-- 05_reminders.sql
-- Create reminders table, index, and enable security policies

CREATE TABLE IF NOT EXISTS public.reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT,
    remind_at TIMESTAMPTZ NOT NULL,
    type TEXT NOT NULL, -- e.g., 'task', 'habit', 'custom'
    related_entity_type TEXT, -- e.g., 'task', 'habit'
    related_entity_id UUID,
    is_sent BOOLEAN DEFAULT false,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Composite Index for fast reminder checking and chronological scans
CREATE INDEX IF NOT EXISTS idx_reminders_user_id_remind_at ON public.reminders(user_id, remind_at);

-- --- RLS SECURITY POLICIES ---
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own reminders" ON public.reminders;
CREATE POLICY "Users can manage their own reminders"
    ON public.reminders
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
