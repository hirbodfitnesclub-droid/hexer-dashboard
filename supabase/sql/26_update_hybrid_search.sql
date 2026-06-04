-- =========================================================================
-- 26. REWRITE HYBRID SEARCH WITH HARD QUALITY THRESHOLDS
-- =========================================================================

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
