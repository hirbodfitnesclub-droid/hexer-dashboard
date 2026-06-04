-- Add is_active column to discount_codes table idempotently
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Refresh PostgREST schema cache to ensure immediate visibility
NOTIFY pgrst, 'reload schema';
