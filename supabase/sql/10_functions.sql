-- /supabase/sql/10_functions.sql
-- RPC Layer Functions & Event Triggers for automatic AI processing and billing

-- Enable pg_net extension to support webhooks / edge function executions
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Atomic task creation with checklists and tags
CREATE OR REPLACE FUNCTION public.create_task_with_tags(
    p_title TEXT,
    p_description TEXT DEFAULT NULL,
    p_project_id UUID DEFAULT NULL,
    p_due_date TIMESTAMPTZ DEFAULT NULL,
    p_priority TEXT DEFAULT 'medium',
    p_tags TEXT[] DEFAULT '{}',
    p_checklist JSONB DEFAULT '[]'::jsonb
)
RETURNS SETOF public.tasks AS $$
BEGIN
    RETURN QUERY
    INSERT INTO public.tasks (
        user_id,
        project_id,
        title,
        description,
        priority,
        due_date,
        tags,
        checklist,
        created_at,
        updated_at
    )
    VALUES (
        auth.uid(),
        p_project_id,
        p_title,
        p_description,
        p_priority,
        p_due_date,
        p_tags,
        p_checklist,
        now(),
        now()
    )
    RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Atomic note creation with tags
CREATE OR REPLACE FUNCTION public.create_note_with_tags(
    p_title TEXT,
    p_content TEXT DEFAULT NULL,
    p_project_id UUID DEFAULT NULL,
    p_tags TEXT[] DEFAULT '{}'
)
RETURNS SETOF public.notes AS $$
BEGIN
    RETURN QUERY
    INSERT INTO public.notes (
        user_id,
        project_id,
        title,
        content,
        tags,
        created_at,
        updated_at
    )
    VALUES (
        auth.uid(),
        p_project_id,
        p_title,
        p_content,
        p_tags,
        now(),
        now()
    )
    RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Hybrid cosine similarity semantic search filter under strict RLS
CREATE OR REPLACE FUNCTION public.match_documents(
    query_embedding vector(768),
    match_threshold float,
    match_count int
)
RETURNS TABLE (
    id UUID,
    type TEXT,
    title TEXT,
    content TEXT,
    similarity float8
) AS $$
BEGIN
    RETURN QUERY
    SELECT combined.id, combined.type, combined.title, combined.content, combined.similarity
    FROM (
        SELECT 
            t.id,
            'task'::text AS type,
            t.title,
            t.description AS content,
            (1 - (t.embedding <=> query_embedding))::float8 AS similarity
        FROM public.tasks t
        WHERE t.user_id = auth.uid() AND t.embedding IS NOT NULL
        UNION ALL
        SELECT 
            n.id,
            'note'::text AS type,
            n.title,
            n.content AS content,
            (1 - (n.embedding <=> query_embedding))::float8 AS similarity
        FROM public.notes n
        WHERE n.user_id = auth.uid() AND n.embedding IS NOT NULL
    ) combined
    WHERE combined.similarity >= match_threshold
    ORDER BY combined.similarity DESC
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Atomic secure AI quota gateway
CREATE OR REPLACE FUNCTION public.consume_ai_quota()
RETURNS TABLE (
    allowed boolean,
    model text,
    remaining int,
    reason text
) AS $$
DECLARE
    v_user_id UUID;
    v_sub_plan TEXT;
    v_sub_status TEXT;
    v_sub_expires TIMESTAMPTZ;
    v_plan_quota INT;
    v_plan_period_days INT;
    v_plan_model TEXT;
    v_counter_start TIMESTAMPTZ;
    v_counter_end TIMESTAMPTZ;
    v_counter_count INT;
    v_new_count INT;
    v_remaining INT;
BEGIN
    -- 1. Establish User context safely
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN QUERY SELECT false, NULL::text, 0, 'unauthorized'::text;
        RETURN;
    END IF;

    -- 2. Fetch Active status & plan restrictions
    SELECT 
        s.plan_code, s.status, s.expires_at, p.monthly_quota, p.period_days, p.ai_model
    INTO 
        v_sub_plan, v_sub_status, v_sub_expires, v_plan_quota, v_plan_period_days, v_plan_model
    FROM public.subscriptions s
    JOIN public.plans p ON s.plan_code = p.plan_code
    WHERE s.user_id = v_user_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::text, 0, 'no_subscription'::text;
        RETURN;
    END IF;

    -- 3. Locking user counters to avoid race conditions
    SELECT 
        period_start, period_end, request_count
    INTO 
        v_counter_start, v_counter_end, v_counter_count
    FROM public.usage_counters
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Initialize usage counter if missing
        INSERT INTO public.usage_counters (user_id, period_start, period_end, request_count, updated_at)
        VALUES (v_user_id, now(), v_sub_expires, 0, now())
        RETURNING period_start, period_end, request_count INTO v_counter_start, v_counter_end, v_counter_count;
    END IF;

    -- 4. Verify Free Plan rules
    IF v_sub_plan = 'free' THEN
        -- Checks expiration
        IF now() > v_sub_expires THEN
            RETURN QUERY SELECT false, v_plan_model, 0, 'trial_expired'::text;
            RETURN;
        END IF;
        -- Checks quota
        IF v_counter_count >= v_plan_quota THEN
            RETURN QUERY SELECT false, v_plan_model, 0, 'quota_exceeded'::text;
            RETURN;
        END IF;
    ELSE
        -- 5. Verify Paid Plans rules
        IF v_sub_status != 'active' OR now() > v_sub_expires THEN
            RETURN QUERY SELECT false, v_plan_model, 0, 'subscription_expired'::text;
            RETURN;
        END IF;

        -- Dynamic Period Reset if billing cycle ended (Atomic Reset)
        IF now() > v_counter_end THEN
            v_counter_start := now();
            v_counter_end := now() + (interval '1 day' * v_plan_period_days);
            v_counter_count := 0;

            UPDATE public.usage_counters
            SET 
                period_start = v_counter_start,
                period_end = v_counter_end,
                request_count = v_counter_count,
                updated_at = now()
            WHERE user_id = v_user_id;
        END IF;

        -- Check quota limits
        IF v_counter_count >= v_plan_quota THEN
            RETURN QUERY SELECT false, v_plan_model, 0, 'quota_exceeded'::text;
            RETURN;
        END IF;
    END IF;

    -- 6. Process quota usage transaction
    v_new_count := v_counter_count + 1;
    v_remaining := GREATEST(0, v_plan_quota - v_new_count);

    UPDATE public.usage_counters
    SET 
        request_count = v_new_count,
        updated_at = now()
    WHERE user_id = v_user_id;

    -- Insert request log
    INSERT INTO public.ai_requests_log (user_id, mode, model, created_at)
    VALUES (v_user_id, 'consume_ai_quota', v_plan_model, now());

    RETURN QUERY SELECT true, v_plan_model, v_remaining, 'quota_available'::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Subscription upgrade/activation handler
CREATE OR REPLACE FUNCTION public.activate_subscription(
    p_user_id UUID,
    p_plan_code TEXT,
    p_payment_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_payment_status TEXT;
    v_period_days INT;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- 1. Validate payment trace records
    SELECT status INTO v_payment_status 
    FROM public.payments 
    WHERE id = p_payment_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment record not found.';
    END IF;

    -- Update order status to paid (Idempotency check)
    IF v_payment_status = 'pending' THEN
        UPDATE public.payments
        SET status = 'paid', paid_at = now()
        WHERE id = p_payment_id AND user_id = p_user_id;
    ELSIF v_payment_status != 'paid' THEN
        RAISE EXCEPTION 'Payment is in an invalid state: %', v_payment_status;
    END IF;

    -- 2. Extract Plan boundaries
    SELECT period_days INTO v_period_days
    FROM public.plans
    WHERE plan_code = p_plan_code;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Plan code % not found.', p_plan_code;
    END IF;

    v_expires_at := now() + (interval '1 day' * v_period_days);

    -- 3. Upsert subscriptions schema
    INSERT INTO public.subscriptions (user_id, plan_code, status, started_at, expires_at, updated_at)
    VALUES (p_user_id, p_plan_code, 'active', now(), v_expires_at, now())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        plan_code = EXCLUDED.plan_code,
        status = 'active',
        started_at = EXCLUDED.started_at,
        expires_at = EXCLUDED.expires_at,
        updated_at = now();

    -- 4. Upsert dynamic usage tracker
    INSERT INTO public.usage_counters (user_id, period_start, period_end, request_count, updated_at)
    VALUES (p_user_id, now(), v_expires_at, 0, now())
    ON CONFLICT (user_id)
    DO UPDATE SET
        period_start = EXCLUDED.period_start,
        period_end = EXCLUDED.period_end,
        request_count = 0,
        updated_at = now();

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Trigger for automatic non-blocking Vectorization
CREATE OR REPLACE FUNCTION public.enqueue_vectorize()
RETURNS TRIGGER AS $$
DECLARE
    v_supabase_url TEXT;
    v_service_key TEXT;
    v_content TEXT;
    v_type TEXT;
BEGIN
    -- Read URL & Service Key dynamically from configurations, fallback to defaults
    v_supabase_url := COALESCE(
        NULLIF(current_setting('app.settings.supabase_url', true), ''),
        'http://kong:8000'
    );
    v_service_key := COALESCE(
        NULLIF(current_setting('app.settings.supabase_service_role_key', true), ''),
        NULLIF(current_setting('app.settings.service_role_key', true), ''),
        ''
    );

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

    -- Perform non-blocking webhook request using pg_net
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

-- Trigger binding for Tasks INSERT
DROP TRIGGER IF EXISTS trigger_vectorize_task_insert ON public.tasks;
CREATE TRIGGER trigger_vectorize_task_insert
    AFTER INSERT
    ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.enqueue_vectorize();

-- Trigger binding for Tasks UPDATE
DROP TRIGGER IF EXISTS trigger_vectorize_task_update ON public.tasks;
CREATE TRIGGER trigger_vectorize_task_update
    AFTER UPDATE OF title, description
    ON public.tasks
    FOR EACH ROW
    WHEN (
        (OLD.title IS DISTINCT FROM NEW.title) OR 
        (OLD.description IS DISTINCT FROM NEW.description)
    )
    EXECUTE FUNCTION public.enqueue_vectorize();

-- Trigger binding for Notes INSERT
DROP TRIGGER IF EXISTS trigger_vectorize_note_insert ON public.notes;
CREATE TRIGGER trigger_vectorize_note_insert
    AFTER INSERT
    ON public.notes
    FOR EACH ROW
    EXECUTE FUNCTION public.enqueue_vectorize();

-- Trigger binding for Notes UPDATE
DROP TRIGGER IF EXISTS trigger_vectorize_note_update ON public.notes;
CREATE TRIGGER trigger_vectorize_note_update
    AFTER UPDATE OF title, content
    ON public.notes
    FOR EACH ROW
    WHEN (
        (OLD.title IS DISTINCT FROM NEW.title) OR 
        (OLD.content IS DISTINCT FROM NEW.content)
    )
    EXECUTE FUNCTION public.enqueue_vectorize();
