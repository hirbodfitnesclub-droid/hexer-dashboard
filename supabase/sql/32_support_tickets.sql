-- supabase/sql/32_support_tickets.sql
-- Support ticket database setup with Row Level Security (RLS) and Telegram notification triggers.

-- 1. Create support tickets table
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_status CHECK (status IN ('open', 'closed'))
);

-- index for optimizing queries on support tickets
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_created ON public.support_tickets (user_id, created_at);

-- Enable Row Level Security
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- 2. Create RLS Policies for users
DROP POLICY IF EXISTS "Users can view their own support tickets" ON public.support_tickets;
CREATE POLICY "Users can view their own support tickets"
    ON public.support_tickets
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own support tickets" ON public.support_tickets;
CREATE POLICY "Users can insert their own support tickets"
    ON public.support_tickets
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- 3. Trigger Function to format and send Telegram notification when a support ticket occurs
CREATE OR REPLACE FUNCTION public.notify_telegram_on_new_ticket()
RETURNS TRIGGER AS $$
DECLARE
    v_bot_token TEXT;
    v_chat_id TEXT;
    v_enabled BOOLEAN;
    v_user_name TEXT;
    v_user_email TEXT;
    v_message TEXT;
BEGIN
    -- Retrieve settings from telegram_settings
    SELECT bot_token, chat_id, is_enabled
    INTO v_bot_token, v_chat_id, v_enabled
    FROM public.telegram_settings
    WHERE id = 1;
    
    -- Check if notification is enabled and settings exist
    IF v_enabled = true AND v_bot_token IS NOT NULL AND trim(v_bot_token) <> '' AND v_chat_id IS NOT NULL AND trim(v_chat_id) <> '' THEN
        
        -- Fetch User full_name safely
        SELECT COALESCE(full_name, 'کاربر بدون نام')
        INTO v_user_name
        FROM public.profiles
        WHERE id = NEW.user_id;

        -- Fetch User email safely from auth.users
        SELECT email
        INTO v_user_email
        FROM auth.users
        WHERE id = NEW.user_id;
        
        -- Construct the notification text message in Persian (HTML formatted)
        v_message := '✉️ <b>تیکت پشتیبانی جدید</b>' || E'\n\n' ||
                     '👤 <b>کاربر:</b> ' || v_user_name || E'\n' ||
                     '📧 <b>ایمیل:</b> ' || COALESCE(v_user_email, 'نامشخص') || E'\n' ||
                     '🏷️ <b>موضوع:</b> ' || NEW.subject || E'\n\n' ||
                     '📝 <b>متن تیکت:</b>' || E'\n' || NEW.message || E'\n\n' ||
                     '👇 برای پاسخ یا مدیریت تیکت‌ها، به پنل مدیریت مراجعه کنید.';
        
        -- Perform the non-blocking HTTP request asynchronously to Telegram sendMessage API
        PERFORM net.http_post(
            url := 'https://api.telegram.org/bot' || v_bot_token || '/sendMessage',
            headers := '{"Content-Type": "application/json"}'::jsonb,
            body := jsonb_build_object(
                'chat_id', v_chat_id,
                'text', v_message,
                'parse_mode', 'HTML'
            ),
            timeout_milliseconds := 5000
        );
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Bind Trigger to public.support_tickets table
DROP TRIGGER IF EXISTS trg_notify_telegram_on_new_ticket ON public.support_tickets;

CREATE TRIGGER trg_notify_telegram_on_new_ticket
    AFTER INSERT ON public.support_tickets
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_telegram_on_new_ticket();

-- 5. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
