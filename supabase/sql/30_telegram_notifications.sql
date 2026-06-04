-- supabase/sql/30_telegram_notifications.sql
-- Subscribes to new offline manual payments and sends notifications to a Telegram Bot asynchronously.

-- 1. Create a table to store Telegram settings securely
CREATE TABLE IF NOT EXISTS public.telegram_settings (
    id INT PRIMARY KEY DEFAULT 1,
    bot_token TEXT,
    chat_id TEXT,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT one_row CHECK (id = 1)
);

-- Seed with a default blank row if it does not exist
INSERT INTO public.telegram_settings (id, bot_token, chat_id, is_enabled)
VALUES (1, '', '', false)
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security (RLS) on Telegram settings to prevent public client exposure
ALTER TABLE public.telegram_settings ENABLE ROW LEVEL SECURITY;

-- Note: We do not declare any SELECT policies for authenticated or anonymous public roles.
-- This ensures that only the service_role key (which is used in Edge Functions or direct triggers) can read or modify the bot token.

-- 2. Trigger Function to format and send Telegram notifications
CREATE OR REPLACE FUNCTION public.notify_telegram_on_manual_payment()
RETURNS TRIGGER AS $$
DECLARE
    v_bot_token TEXT;
    v_chat_id TEXT;
    v_enabled BOOLEAN;
    v_user_name TEXT;
    v_plan_name TEXT;
    v_message TEXT;
    v_amount_formatted TEXT;
BEGIN
    -- Only trigger for offline card_to_card payments in pending_manual status
    IF NEW.gateway = 'card_to_card' AND NEW.status = 'pending_manual' THEN
        
        -- Retrieve settings
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
            
            -- Fetch Plan display_name safely
            SELECT COALESCE(display_name, NEW.plan_code)
            INTO v_plan_name
            FROM public.plans
            WHERE plan_code = NEW.plan_code;
            
            -- Format final payment amount nicely
            v_amount_formatted := to_char(NEW.final_amount_irr, 'FM999,999,999,999') || ' ریال';
            
            -- Construct the notification text message in Persian (HTML formatted)
            v_message := '🔔 <b>درخواست کارت به کارت جدید</b>' || E'\n\n' ||
                         '👤 <b>کاربر:</b> ' || v_user_name || E'\n' ||
                         '📦 <b>پلن انتخابی:</b> ' || v_plan_name || E'\n' ||
                         '💰 <b>مبلغ پرداختی:</b> ' || v_amount_formatted || E'\n\n' ||
                         '👇 برای بررسی فیش بانکی ارسالی و تغییر اشتراک، به پنل مدیریت سایت مراجعه نمایید.';
            
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
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Bind Trigger to public.payments table
DROP TRIGGER IF EXISTS trg_notify_telegram_on_manual_payment ON public.payments;

CREATE TRIGGER trg_notify_telegram_on_manual_payment
    AFTER INSERT ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_telegram_on_manual_payment();

-- 4. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
