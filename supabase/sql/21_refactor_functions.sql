-- 21_refactor_functions.sql
-- RPC Layer Functions for Hexer AI Refactor (Phase A - R2)
-- All functions are idempotent and defined securely with RLS awareness and security definer search pathways.

-- =========================================================================
-- 1. TASK-NOTE ATOMIC LINKS (Idempotent linking functions)
-- =========================================================================

-- Create a bidirectional connection between a task and a note
CREATE OR REPLACE FUNCTION public.link_task_note(p_task_id UUID, p_note_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_task_exists BOOLEAN;
    v_note_exists BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Verify user owns the task
    SELECT EXISTS(
        SELECT 1 FROM public.tasks 
        WHERE id = p_task_id AND user_id = v_user_id
    ) INTO v_task_exists;

    -- Verify user owns the note
    SELECT EXISTS(
        SELECT 1 FROM public.notes 
        WHERE id = p_note_id AND user_id = v_user_id
    ) INTO v_note_exists;

    IF NOT v_task_exists OR NOT v_note_exists THEN
        RAISE EXCEPTION 'Task or Note not found or ownership verify failed.';
    END IF;

    -- Atomic idempotent insert
    INSERT INTO public.task_note_links (user_id, task_id, note_id)
    VALUES (v_user_id, p_task_id, p_note_id)
    ON CONFLICT (task_id, note_id) DO NOTHING;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- Delete a bidirectional connection between a task and a note
CREATE OR REPLACE FUNCTION public.unlink_task_note(p_task_id UUID, p_note_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    DELETE FROM public.task_note_links
    WHERE user_id = v_user_id AND task_id = p_task_id AND note_id = p_note_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- Fetch all notes linked to a specific task
CREATE OR REPLACE FUNCTION public.get_linked_notes(p_task_id UUID)
RETURNS SETOF public.notes AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Verify task ownership first
    IF NOT EXISTS(SELECT 1 FROM public.tasks WHERE id = p_task_id AND user_id = v_user_id) THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT n.*
    FROM public.notes n
    JOIN public.task_note_links l ON n.id = l.note_id
    WHERE l.task_id = p_task_id AND l.user_id = v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- Fetch all tasks linked to a specific note
CREATE OR REPLACE FUNCTION public.get_linked_tasks(p_note_id UUID)
RETURNS SETOF public.tasks AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Verify note ownership first
    IF NOT EXISTS(SELECT 1 FROM public.notes WHERE id = p_note_id AND user_id = v_user_id) THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT t.*
    FROM public.tasks t
    JOIN public.task_note_links l ON t.id = l.task_id
    WHERE l.note_id = p_note_id AND l.user_id = v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =========================================================================
-- 2. HYBRID RAG SEARCH (RRF Cosine Similarity + Trigram Word Comparison)
-- =========================================================================

-- Real RAG Search: Pairs semantic embedding scores with trigram farsi text similarity using Reciprocal Rank Fusion (RRF)
CREATE OR REPLACE FUNCTION public.hybrid_search(
    p_query_embedding vector(768),
    p_query_text TEXT,
    p_match_count INT
)
RETURNS TABLE (
    id UUID,
    type TEXT,
    title TEXT,
    snippet TEXT,
    score FLOAT8
) AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    RETURN QUERY
    WITH vector_results AS (
        SELECT 
            sub.id, sub.type, sub.title, sub.snippet, sub.val_vector,
            ROW_NUMBER() OVER (ORDER BY sub.val_vector DESC) AS rank_val
        FROM (
            SELECT 
                t.id, 'task'::text AS type, t.title, COALESCE(t.description, '') AS snippet,
                CASE WHEN t.embedding IS NULL THEN 0.0::float8 ELSE (1 - (t.embedding <=> p_query_embedding))::float8 END AS val_vector
            FROM public.tasks t
            WHERE t.user_id = v_user_id
            UNION ALL
            SELECT 
                n.id, 'note'::text AS type, n.title, COALESCE(n.content, '') AS snippet,
                CASE WHEN n.embedding IS NULL THEN 0.0::float8 ELSE (1 - (n.embedding <=> p_query_embedding))::float8 END AS val_vector
            FROM public.notes n
            WHERE n.user_id = v_user_id
        ) sub
    ),
    text_results AS (
        SELECT 
            sub.id, sub.type, sub.title, sub.snippet, sub.val_text,
            ROW_NUMBER() OVER (ORDER BY sub.val_text DESC) AS rank_val
        FROM (
            SELECT 
                t.id, 'task'::text AS type, t.title, COALESCE(t.description, '') AS snippet,
                similarity(COALESCE(t.title, '') || ' ' || COALESCE(t.description, ''), p_query_text)::float8 AS val_text
            FROM public.tasks t
            WHERE t.user_id = v_user_id
            UNION ALL
            SELECT 
                n.id, 'note'::text AS type, n.title, COALESCE(n.content, '') AS snippet,
                similarity(COALESCE(n.title, '') || ' ' || COALESCE(n.content, ''), p_query_text)::float8 AS val_text
            FROM public.notes n
            WHERE n.user_id = v_user_id
        ) sub
    )
    SELECT 
        COALESCE(v.id, t.id) AS id,
        COALESCE(v.type, t.type) AS type,
        COALESCE(v.title, t.title) AS title,
        COALESCE(v.snippet, t.snippet) AS snippet,
        (
            COALESCE(1.0 / (60.0 + v.rank_val), 0.0) + 
            COALESCE(1.0 / (60.0 + t.rank_val), 0.0)
        )::float8 AS score
    FROM vector_results v
    FULL OUTER JOIN text_results t ON v.id = t.id AND v.type = t.type
    ORDER BY score DESC
    LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =========================================================================
-- 3. USAGE MONITORING AND ANALYSIS
-- =========================================================================

-- Read AI quota display values without incrementing counters
CREATE OR REPLACE FUNCTION public.get_usage_status()
RETURNS TABLE (
    plan_code TEXT,
    display_name TEXT,
    monthly_quota INT,
    request_count INT,
    remaining INT,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
) AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    RETURN QUERY
    SELECT 
        s.plan_code::text,
        p.display_name::text,
        p.monthly_quota::int,
        COALESCE(c.request_count, 0)::int,
        GREATEST(0, p.monthly_quota - COALESCE(c.request_count, 0))::int AS remaining,
        COALESCE(c.period_start, s.started_at) AS period_start,
        COALESCE(c.period_end, s.expires_at) AS period_end,
        s.expires_at
    FROM public.subscriptions s
    JOIN public.plans p ON s.plan_code = p.plan_code
    LEFT JOIN public.usage_counters c ON s.user_id = c.user_id
    WHERE s.user_id = v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- Aggregate log of requests in Asia/Tehran timezone to draw usage frequency charts
CREATE OR REPLACE FUNCTION public.get_daily_usage(p_days INT)
RETURNS TABLE (
    usage_date DATE,
    request_count INT
) AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    RETURN QUERY
    SELECT 
        (created_at AT TIME ZONE 'Asia/Tehran')::date AS usage_date,
        COUNT(*)::int AS request_count
    FROM public.ai_requests_log
    WHERE user_id = v_user_id 
      AND created_at >= (now() AT TIME ZONE 'Asia/Tehran' - (p_days || ' days')::interval)
    GROUP BY (created_at AT TIME ZONE 'Asia/Tehran')::date
    ORDER BY usage_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =========================================================================
-- 4. DAILY CHAT SESSIONS & RETENTION HISTORY
-- =========================================================================

-- Atomic creation or fetch of today's chat session in Tehran timezone
CREATE OR REPLACE FUNCTION public.get_or_create_today_session()
RETURNS SETOF public.chat_sessions AS $$
DECLARE
    v_user_id UUID;
    v_today DATE;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    v_today := (now() AT TIME ZONE 'Asia/Tehran')::date;

    -- Try insertion; handle duplicate key constraint gracefully
    INSERT INTO public.chat_sessions (user_id, session_date)
    VALUES (v_user_id, v_today)
    ON CONFLICT (user_id, session_date) DO NOTHING;

    RETURN QUERY
    SELECT * FROM public.chat_sessions
    WHERE user_id = v_user_id AND session_date = v_today;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- Pull sessions list and prune/lazy-clean sessions older than 30 days
CREATE OR REPLACE FUNCTION public.get_chat_sessions(p_limit INT)
RETURNS SETOF public.chat_sessions AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Lazy auto-cleanup fallback for older chat sessions representing retention period
    DELETE FROM public.chat_sessions
    WHERE user_id = v_user_id 
      AND session_date < ((now() AT TIME ZONE 'Asia/Tehran')::date - INTERVAL '30 days');

    RETURN QUERY
    SELECT * FROM public.chat_sessions
    WHERE user_id = v_user_id
    ORDER BY session_date DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
