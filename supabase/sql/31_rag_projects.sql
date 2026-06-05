-- =========================================================================
-- Migration: 31_rag_projects.sql
-- Goal: Add embedding column to projects table, connect indexing trigger,
--       and rewrite hybrid search to include projects.
-- =========================================================================

-- Step 1: Add vector embedding column to the projects table if it doesn't already exist
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Step 2: Re-create enqueue_vectorize function supporting the projects table
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
    ELSIF TG_TABLE_NAME = 'projects' THEN
        v_type := 'project';
        v_content := COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.description, '');
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

-- Step 3: Attach vector triggers for projects table
DROP TRIGGER IF EXISTS trigger_vectorize_project_insert ON public.projects;
CREATE TRIGGER trigger_vectorize_project_insert
    AFTER INSERT
    ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.enqueue_vectorize();

DROP TRIGGER IF EXISTS trigger_vectorize_project_update ON public.projects;
CREATE TRIGGER trigger_vectorize_project_update
    AFTER UPDATE OF title, description
    ON public.projects
    FOR EACH ROW
    WHEN (
        (OLD.title IS DISTINCT FROM NEW.title) OR 
        (OLD.description IS DISTINCT FROM NEW.description)
    )
    EXECUTE FUNCTION public.enqueue_vectorize();

-- Step 4: Rebuild hybrid search function including projects table representation
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
            UNION ALL
            SELECT 
                p.id, 'project'::text AS type, p.title, COALESCE(p.description, '') AS snippet,
                CASE WHEN p.embedding IS NULL THEN 0.0::float8 ELSE (1 - (p.embedding <=> p_query_embedding))::float8 END AS val_vector
            FROM public.projects p
            WHERE p.user_id = v_user_id
        ) sub
        WHERE sub.val_vector >= 0.25
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
            UNION ALL
            SELECT 
                p.id, 'project'::text AS type, p.title, COALESCE(p.description, '') AS snippet,
                similarity(COALESCE(p.title, '') || ' ' || COALESCE(p.description, ''), p_query_text)::float8 AS val_text
            FROM public.projects p
            WHERE p.user_id = v_user_id
        ) sub
        WHERE sub.val_text >= 0.01
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

-- Force reloading the PostgREST schema so new columns and endpoints become active
NOTIFY pgrst, 'reload schema';
