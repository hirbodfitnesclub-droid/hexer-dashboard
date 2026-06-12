ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS anonymous_id UUID;
CREATE INDEX IF NOT EXISTS idx_profiles_anonymous_id ON public.profiles(anonymous_id);