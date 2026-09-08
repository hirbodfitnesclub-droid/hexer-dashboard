-- 40_admin_audit_and_settings.sql
-- Simple admin activity log (legacy-secret compatible) + panel app settings.
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID,
  admin_user_id UUID,
  admin_label TEXT NOT NULL DEFAULT 'arash',
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Compatibility with tables created before admin_label existed:
-- the legacy shared-secret path has no auth user id.
ALTER TABLE public.admin_audit_log ADD COLUMN IF NOT EXISTS admin_label TEXT NOT NULL DEFAULT 'arash';
ALTER TABLE public.admin_audit_log ALTER COLUMN admin_user_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_audit_created
  ON public.admin_audit_log (created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Singleton settings row (e.g. card-to-card destination card).
CREATE TABLE IF NOT EXISTS public.app_settings (
  id INT PRIMARY KEY DEFAULT 1 CONSTRAINT app_settings_singleton CHECK (id = 1),
  destination_card_number TEXT NOT NULL DEFAULT '',
  destination_card_owner TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
