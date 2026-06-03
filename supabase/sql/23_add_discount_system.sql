-- 23_add_discount_system.sql
-- Create discount_codes table and integrate into payment/subscription workflow

CREATE TABLE IF NOT EXISTS public.discount_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    discount_percent INT NULL CHECK (discount_percent >= 0 AND discount_percent <= 100),
    discount_amount_irr BIGINT NULL CHECK (discount_amount_irr >= 0),
    max_uses INT NULL,
    used_count INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT check_limits CHECK (max_uses IS NULL OR used_count <= max_uses)
);

-- Refinement constraint: Check that a coupon code has either a percentage or a fixed amount, but not both.
ALTER TABLE public.discount_codes DROP CONSTRAINT IF EXISTS check_discount_type;
ALTER TABLE public.discount_codes ADD CONSTRAINT check_discount_type CHECK (
    (discount_percent IS NOT NULL AND discount_amount_irr IS NULL) OR
    (discount_percent IS NULL AND discount_amount_irr IS NOT NULL)
);

-- Index for speedy query retrieval
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON public.discount_codes(code);

-- Enable Row Level Security (RLS)
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view discount codes (for check/validation logic)
DROP POLICY IF EXISTS "Allow select for authenticated users" ON public.discount_codes;
CREATE POLICY "Allow select for authenticated users"
    ON public.discount_codes
    FOR SELECT
    TO authenticated
    USING (true);

-- Alter payments table to support discount tracking
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS discount_code_id UUID REFERENCES public.discount_codes(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS discount_amount_irr BIGINT DEFAULT 0;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS final_amount_irr BIGINT DEFAULT 0;

-- Overwrite subscription activation procedure with robust Guardrail 2 enforcement
CREATE OR REPLACE FUNCTION public.activate_subscription(
    p_user_id UUID,
    p_plan_code TEXT,
    p_payment_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_payment_status TEXT;
    v_period_days INT;
    v_expires_at TIMESTAMPTZ;
    v_discount_code_id UUID;
    v_discount_code TEXT;
    v_max_uses INT;
    v_used_count INT;
    v_expires_at_code TIMESTAMPTZ;
BEGIN
    -- 1. Validate payment trace records and extract discount fields
    SELECT status, discount_code_id INTO v_payment_status, v_discount_code_id
    FROM public.payments 
    WHERE id = p_payment_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Record of payment not found.';
    END IF;

    -- Update order status to paid (Idempotency check)
    IF v_payment_status = 'pending' THEN
        -- Check and process discount code capacity if any exists
        IF v_discount_code_id IS NOT NULL THEN
            -- Lock the discount code row to prevent race conditions during concurrent verifications
            SELECT code, max_uses, used_count, expires_at 
            INTO v_discount_code, v_max_uses, v_used_count, v_expires_at_code
            FROM public.discount_codes
            WHERE id = v_discount_code_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Discount code not found.';
            END IF;

            -- Validate expiration
            IF v_expires_at_code IS NOT NULL AND v_expires_at_code < now() THEN
                RAISE EXCEPTION 'کد تخفیف % منقضی شده است.', v_discount_code;
            END IF;

            -- Guardrail 2: Strict limit capacity check inside active transaction
            -- If used_count already reached max_uses, RAISE EXCEPTION to roll back transaction
            IF v_max_uses IS NOT NULL AND v_used_count >= v_max_uses THEN
                RAISE EXCEPTION 'کد تخفیف % ظرفیت آن به پایان رسیده است و فعال‌سازی لغو گردید.', v_discount_code;
            END IF;

            -- Increment used counter
            UPDATE public.discount_codes
            SET used_count = used_count + 1
            WHERE id = v_discount_code_id;
        END IF;

        UPDATE public.payments
        SET status = 'paid', paid_at = now()
        WHERE id = p_payment_id AND user_id = p_user_id;
    ELSIF v_payment_status != 'paid' THEN
        RAISE EXCEPTION 'Payment is in an invalid state: %', v_payment_status;
    END IF;

    -- 2. Extract Plan boundaries
    SELECT period_days INTO v_period_days
    FROM public.plans
    WHERE plan_code = p_plan_code;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Plan code % not found.', p_plan_code;
    END IF;

    v_expires_at := now() + (interval '1 day' * v_period_days);

    -- 3. Upsert subscriptions schema
    INSERT INTO public.subscriptions (user_id, plan_code, status, started_at, expires_at, updated_at)
    VALUES (p_user_id, p_plan_code, 'active', now(), v_expires_at, now())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        plan_code = EXCLUDED.plan_code,
        status = 'active',
        started_at = EXCLUDED.started_at,
        expires_at = EXCLUDED.expires_at,
        updated_at = now();

    -- 4. Upsert dynamic usage tracker
    INSERT INTO public.usage_counters (user_id, period_start, period_end, request_count, updated_at)
    VALUES (p_user_id, now(), v_expires_at, 0, now())
    ON CONFLICT (user_id)
    DO UPDATE SET
        period_start = EXCLUDED.period_start,
        period_end = EXCLUDED.period_end,
        request_count = 0,
        updated_at = now();

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Notify schema reload to fix PGRST205 and refresh caches
NOTIFY pgrst, 'reload schema';
