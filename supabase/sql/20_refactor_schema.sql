-- 20_refactor_schema.sql
-- Database adjustments and new tables for Hexer AI Refactor (Phase A - R1)
-- All operations are idempotent, maintaining compatibility with existing tables.

-- =========================================================================
-- 1. PROFILES CUSTOMIZATIONS (Onboarding Support)
-- =========================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS specialty TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS interests TEXT[] DEFAULT '{}'::TEXT[];

-- =========================================================================
-- 2. TASK_NOTE_LINKS (Bidirectional Entity Linking)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.task_note_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT task_note_links_task_id_note_id_key UNIQUE (task_id, note_id)
);

-- Performance Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_task_note_links_user_id ON public.task_note_links(user_id);
CREATE INDEX IF NOT EXISTS idx_task_note_links_task_id ON public.task_note_links(task_id);
CREATE INDEX IF NOT EXISTS idx_task_note_links_note_id ON public.task_note_links(note_id);

-- Enable RLS and establish policies
ALTER TABLE public.task_note_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own task note links" ON public.task_note_links;
CREATE POLICY "Users can manage their own task note links"
    ON public.task_note_links FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================================================
-- 3. CHAT HISTORY SCHEMAS (Persistent Daily Chats)
-- =========================================================================

-- Daily Chat Sessions (Unique per user + date in Asia/Tehran)
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT chat_sessions_user_id_session_date_key UNIQUE (user_id, session_date)
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON public.chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_session_date ON public.chat_sessions(session_date);

-- Enable RLS and establish policies for chat sessions
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own chat sessions" ON public.chat_sessions;
CREATE POLICY "Users can manage their own chat sessions"
    ON public.chat_sessions FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Chat Messages (Cascades on session deletion)
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'ai')),
    text TEXT NOT NULL,
    mode TEXT, -- auto/action/memory
    citations JSONB DEFAULT '[]'::jsonb,
    action_results JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Compound index for optimal message ordering and performance inside active session
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_order ON public.chat_messages(user_id, session_id, created_at);

-- Enable RLS and establish policies for chat messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own chat messages" ON public.chat_messages;
CREATE POLICY "Users can manage their own chat messages"
    ON public.chat_messages FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================================================
-- 4. RETENTION JOB (pg_cron or Fallback Documentation)
-- =========================================================================
-- To support automated daily retention of chat history for up to 30 days, we can optionally use pg_cron.
-- Since pg_cron is not guaranteed to be available in multi-tenant shared tiers of Supabase,
-- we also implement a lazy auto-cleanup fallback at the RPC layer (using get_chat_sessions in R2).
-- Underneath is the pg_cron schedule template if desired:
--
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule(
--   'cleanup-old-chats',
--   '0 3 * * *', -- Everyday at 3:00 AM UTC
--   $$DELETE FROM public.chat_sessions WHERE session_date < ((now() AT TIME ZONE 'Asia/Tehran')::date - INTERVAL '30 days')$$
-- );

-- =========================================================================
-- 5. TEXT INDEXING FOR HYBRID SEARCH (Trigram GIN)
-- =========================================================================
-- IMPORTANT NOTE: GIN Trigram indexes are highly efficient for Persian text similarity.
-- "CREATE INDEX CONCURRENTLY" cannot run inside a multi-statement transaction (e.g. BEGIN/COMMIT).
-- Please execute the statements below individually outside transaction blocks, or run them last.
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_tasks_title_trgm ON public.tasks USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tasks_description_trgm ON public.tasks USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_notes_title_trgm ON public.notes USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_notes_content_trgm ON public.notes USING gin (content gin_trgm_ops);