-- 39_ticket_admin_reply.sql
-- Single admin reply + full ticket statuses for the admin panel.
-- Idempotent: safe to re-run.

ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS admin_reply TEXT;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- The old check only allowed ('open','closed') and rejected pending/resolved.
ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS chk_status;
ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_status_check;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_status' AND conrelid = 'public.support_tickets'::regclass
  ) THEN
    ALTER TABLE public.support_tickets
      ADD CONSTRAINT chk_status CHECK (status IN ('open', 'pending', 'resolved', 'closed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_support_tickets_status_created
  ON public.support_tickets (status, created_at DESC);
