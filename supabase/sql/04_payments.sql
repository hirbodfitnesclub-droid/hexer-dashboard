-- 04_payments.sql
-- Create payments table with defensive, read-only RLS policies for client protection

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Used as order_id in Zibal gateway requests
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_code TEXT NOT NULL REFERENCES public.plans(plan_code),
    amount_irr BIGINT NOT NULL, -- Keep payment values in whole IR Rial numbers, never float or non-integers
    gateway TEXT NOT NULL DEFAULT 'zibal',
    track_id TEXT, -- Initial gateway operation tracking ID
    ref_number TEXT, -- Verified bank clearance receipt trace number
    status TEXT NOT NULL DEFAULT 'pending', -- pending / paid / failed / canceled
    created_at TIMESTAMPTZ DEFAULT now(),
    paid_at TIMESTAMPTZ
);

-- Index for speedy query retrieval
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);

-- --- DEFENSIVE SECURITY RLS POLICIES ---
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Select policy: Users can only select/retrieve their own records
DROP POLICY IF EXISTS "Users can only view their own payments" ON public.payments;
CREATE POLICY "Users can only view their own payments"
    ON public.payments
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Note: We intentionally DO NOT define INSERT/UPDATE policies for standard authenticated clients in public schema.
-- This ensures that payments can never be directly initiated or upgraded manually from client browser code.
-- All write transformations (creation of pending orders, status promotion to 'paid') must run with the security-bypassing service_role key within sandbox Edge functions or database procedures.
