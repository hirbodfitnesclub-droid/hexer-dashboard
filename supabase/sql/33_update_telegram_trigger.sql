-- supabase/sql/33_update_telegram_trigger.sql
-- Goal: Update support ticket notification trigger to fetch and include mobile number (phone).

CREATE OR REPLACE FUNCTION public.notify_telegram_on_new_ticket()
RETURNS TRIGGER AS $$
DECLARE
    v_bot_token TEXT;
    v_chat_id TEXT;
    v_enabled BOOLEAN;
    v_user_name TEXT;
    v_user_email TEXT;
    v_user_phone TEXT;
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

        -- Fetch User email and phone safely from auth.users
        SELECT email, phone
        INTO v_user_email, v_user_phone
        FROM auth.users
        WHERE id = NEW.user_id;
        
        -- Construct the notification text message in Persian (HTML formatted)
        v_message := '✉️ <b>تیکت پشتیبانی جدید</b>' || E'\n\n' ||
                     '👤 <b>کاربر:</b> ' || v_user_name || E'\n' ||
                     '📧 <b>ایمیل:</b> ' || COALESCE(v_user_email, 'نامشخص') || E'\n' ||
                     '📱 <b>موبایل:</b> ' || COALESCE(v_user_phone, 'نامشخص') || E'\n' ||
                     '🏷️ <b>موضوع:</b> ' || NEW.subject || E'\n\n' ||
                     '📝 <b>متن تیکت:</b>' || E'\n' || NEW.message || E'\n\n' ||
                     '👇 برای پاسخ یا مدیریت تیکت‌ها، به پنل مدیریت مراجعه کنید.
                     panel.hexerapp.ir
                     ';
        
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

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
