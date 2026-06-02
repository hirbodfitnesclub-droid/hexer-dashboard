-- 03_core.sql
-- Development of core business domain tables, indices, and row-level security

-- 1. Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    priority TEXT DEFAULT 'medium',
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tasks Table (with checklist JSONB & vector embedding)
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo',
    priority TEXT DEFAULT 'medium',
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    tags TEXT[],
    checklist JSONB DEFAULT '[]'::jsonb,
    embedding vector(768),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Notes Table (with vector embedding)
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content TEXT,
    tags TEXT[],
    embedding vector(768),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Habits Table
CREATE TABLE IF NOT EXISTS public.habits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- Keep "name" in alignment with types.ts and habitService.ts
    description TEXT,
    frequency TEXT DEFAULT 'daily',
    target_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Habit Completions Table
CREATE TABLE IF NOT EXISTS public.habit_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
    completion_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT habit_completions_habit_id_completion_date_key UNIQUE (habit_id, completion_date)
);

-- 6. Media Assets Table
CREATE TABLE IF NOT EXISTS public.media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bucket TEXT NOT NULL,
    path TEXT NOT NULL,
    mime_type TEXT,
    size_bytes BIGINT,
    purpose TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- --- INDEXES FOR PERFORMANCE OPTIMIZATION ---

-- Normal Indexes on User ID / FK Columns
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_project_id ON public.notes(project_id);
CREATE INDEX IF NOT EXISTS idx_habits_user_id ON public.habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_completions_user_id ON public.habit_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_completions_habit_id ON public.habit_completions(habit_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_user_id ON public.media_assets(user_id);

-- HNSW Vector Cosine Indexes (optimized for semantic searches at scale)
CREATE INDEX IF NOT EXISTS idx_tasks_embedding_hnsw ON public.tasks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_notes_embedding_hnsw ON public.notes USING hnsw (embedding vector_cosine_ops);

-- --- ROW LEVEL SECURITY (RLS) & POLICIES ---

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

-- Project Policies
DROP POLICY IF EXISTS "Users can manage their own projects" ON public.projects;
CREATE POLICY "Users can manage their own projects" 
    ON public.projects FOR ALL TO authenticated 
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Task Policies
DROP POLICY IF EXISTS "Users can manage their own tasks" ON public.tasks;
CREATE POLICY "Users can manage their own tasks" 
    ON public.tasks FOR ALL TO authenticated 
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Note Policies
DROP POLICY IF EXISTS "Users can manage their own notes" ON public.notes;
CREATE POLICY "Users can manage their own notes" 
    ON public.notes FOR ALL TO authenticated 
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Habit Policies
DROP POLICY IF EXISTS "Users can manage their own habits" ON public.habits;
CREATE POLICY "Users can manage their own habits" 
    ON public.habits FOR ALL TO authenticated 
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Habit Completions Policies
DROP POLICY IF EXISTS "Users can manage their own habit completions" ON public.habit_completions;
CREATE POLICY "Users can manage their own habit completions" 
    ON public.habit_completions FOR ALL TO authenticated 
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Media Assets Policies
DROP POLICY IF EXISTS "Users can manage their own media assets" ON public.media_assets;
CREATE POLICY "Users can manage their own media assets" 
    ON public.media_assets FOR ALL TO authenticated 
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
