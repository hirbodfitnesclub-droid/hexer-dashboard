-- =====================================================================================
-- Migration: 22_fix_vectorize_webhook.sql
-- Goal: Fix and safeguard the vectorization trigger environment fetch settings.
--
-- DEPLOYMENT GUIDE (How to run manually in Supabase SQL Editor if variables are empty):
-- Run the following commands inside your Supabase dashboard SQL editor to configure
-- your API credentials permanently in the PostgreSQL database layer:
--
-- ALTER DATABASE postgres SET app.settings.supabase_url = 'https://YOUR_PROJECT_REF_ID.supabase.co';
-- ALTER DATABASE postgres SET app.settings.supabase_service_role_key = 'YOUR_SUPER_SECURE_SERVICE_ROLE_KEY';
-- =====================================================================================

CREATE OR REPLACE FUNCTION public.enqueue_vectorize()
RETURNS TRIGGER AS $$
DECLARE
    v_supabase_url TEXT;
    v_service_key TEXT;
    v_content TEXT;
    v_type TEXT;
BEGIN
    -- STEP 1: Fetch Supabase Endpoint URL from configurations
    v_supabase_url := COALESCE(
        NULLIF(current_setting('app.settings.supabase_url', true), ''),
        NULLIF(current_setting('app.settings.supabase_api_url', true), ''),
        'http://kong:8000' -- fallback default for local docker/emulator
    );

    -- STEP 2: Fetch Secure Service Role Key
    v_service_key := COALESCE(
        NULLIF(current_setting('app.settings.supabase_service_role_key', true), ''),
        NULLIF(current_setting('app.settings.service_role_key', true), ''),
        NULLIF(current_setting('app.settings.service_key', true), ''),
        '' -- empty fallback to prevent execution if unconfigured in cloud
    );

    -- STEP 3: Handle missing service key gracefully on production/cloud environments
    IF v_service_key = '' AND v_supabase_url NOT LIKE '%kong%' AND v_supabase_url NOT LIKE '%localhost%' THEN
        RAISE WARNING 'enqueue_vectorize skipped: app.settings.supabase_service_role_key is empty. Please run altered database commands.';
        RETURN NEW;
    END IF;

    -- STEP 4: Determine schema types and collect vectorized content string
    IF TG_TABLE_NAME = 'tasks' THEN
        v_type := 'task';
        v_content := COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.description, '');
    ELSIF TG_TABLE_NAME = 'notes' THEN
        v_type := 'note';
        v_content := COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.content, '');
    ELSE
        RETURN NEW;
    END IF;

    -- Avoid sending request if content is completely empty
    IF TRIM(v_content) = '' THEN
        RETURN NEW;
    END IF;

    -- STEP 5: Perform non-blocking webhook request using pg_net
    PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/vectorize',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
        ),
        body := jsonb_build_object(
            'type', v_type,
            'id', NEW.id,
            'content', v_content
        )
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
