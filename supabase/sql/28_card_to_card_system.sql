-- supabase/sql/28_card_to_card_system.sql
-- Atomic idempotent migration for card-to-card offline payment fallback and coupon pre-reservation.

-- 1. Extend payments table columns safely
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS offline_receipt_url TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS manual_decline_reason TEXT;

-- 2. Idempotently create private receipts storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies on storage.objects defined in 11_storage.sql will handle the access control (based on root user folder matching auth.uid())

-- 3. Read-Only RPC preview_discount: simulates a coupon pricing outcome without modification of database
CREATE OR REPLACE FUNCTION public.preview_discount(
    p_plan_code TEXT,
    p_code TEXT
)
RETURNS TABLE (
    valid BOOLEAN,
    reason TEXT,
    plan_price BIGINT,
    discount_amount BIGINT,
    final_amount BIGINT,
    is_full_discount BOOLEAN
) AS $$
DECLARE
    v_price_irr BIGINT;
    v_sanitized_code TEXT;
    v_discount_id UUID;
    v_percent INT;
    v_amt_irr BIGINT;
    v_max_uses INT;
    v_used_count INT;
    v_expires_at TIMESTAMPTZ;
    v_calc_discount BIGINT := 0;
    v_final BIGINT := 0;
BEGIN
    -- 1. Fetch Plan details
    SELECT price_irr INTO v_price_irr
    FROM public.plans
    WHERE plan_code = p_plan_code;

    IF NOT FOUND THEN
        valid := false;
        reason := 'طرح انتخاب شده یافت نشد.';
        plan_price := 0;
        discount_amount := 0;
        final_amount := 0;
        is_full_discount := false;
        RETURN NEXT;
        RETURN;
    END IF;

    -- 2. If code is empty or null, return price details with no discount
    IF p_code IS NULL OR trim(p_code) = '' THEN
        valid := true;
        reason := NULL;
        plan_price := v_price_irr;
        discount_amount := 0;
        final_amount := v_price_irr;
        is_full_discount := false;
        RETURN NEXT;
        RETURN;
    END IF;

    -- 3. Sanitize code
    v_sanitized_code := upper(trim(p_code));

    -- 4. Fetch discount code details
    SELECT id, discount_percent, discount_amount_irr, max_uses, used_count, expires_at
    INTO v_discount_id, v_percent, v_amt_irr, v_max_uses, v_used_count, v_expires_at
    FROM public.discount_codes
    WHERE code = v_sanitized_code;

    IF NOT FOUND THEN
        valid := false;
        reason := 'کد تخفیف وارد شده معتبر نیست.';
        plan_price := v_price_irr;
        discount_amount := 0;
        final_amount := v_price_irr;
        is_full_discount := false;
        RETURN NEXT;
        RETURN;
    END IF;

    -- 5. Expiration check
    IF v_expires_at IS NOT NULL AND v_expires_at < now() THEN
        valid := false;
        reason := 'کد تخفیف وارد شده منقضی شده است.';
        plan_price := v_price_irr;
        discount_amount := 0;
        final_amount := v_price_irr;
        is_full_discount := false;
        RETURN NEXT;
        RETURN;
    END IF;

    -- 6. Max uses check
    IF v_max_uses IS NOT NULL AND v_used_count >= v_max_uses THEN
        valid := false;
        reason := 'ظرفیت استفاده از این کد تخفیف به پایان رسیده است.';
        plan_price := v_price_irr;
        discount_amount := 0;
        final_amount := v_price_irr;
        is_full_discount := false;
        RETURN NEXT;
        RETURN;
    END IF;

    -- 7. Calculate discount
    IF v_percent IS NOT NULL THEN
        v_calc_discount := floor(v_price_irr * v_percent / 100.0)::bigint;
    ELSIF v_amt_irr IS NOT NULL THEN
        v_calc_discount := v_amt_irr;
    END IF;

    -- Cap discount
    v_calc_discount := least(v_price_irr, v_calc_discount);
    v_final := v_price_irr - v_calc_discount;

    -- Guardrail 1: bottom threshold check
    IF v_final > 0 AND v_final < 10000 THEN
        valid := false;
        reason := 'مبلغ نهایی پس از اعمال تخفیف، کمتر از حداقل مجاز شبکه بانکی (۱۰۰۰ تومان) است.';
        plan_price := v_price_irr;
        discount_amount := v_calc_discount;
        final_amount := v_final;
        is_full_discount := false;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Valid coupon successfully simulated
    valid := true;
    reason := NULL;
    plan_price := v_price_irr;
    discount_amount := v_calc_discount;
    final_amount := v_final;
    is_full_discount := (v_final = 0);
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. System RPC submit_manual_payment: registers manual card-to-card and pre-reserves coupons atomically
CREATE OR REPLACE FUNCTION public.submit_manual_payment(
    p_plan_code TEXT,
    p_code TEXT,
    p_receipt_path TEXT
)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
    v_existing_pending BOOLEAN;
    v_price_irr BIGINT;
    v_discount_id UUID := NULL;
    v_percent INT;
    v_amt_irr BIGINT;
    v_max_uses INT;
    v_used_count INT;
    v_expires_at TIMESTAMPTZ;
    v_calc_discount BIGINT := 0;
    v_final_amount BIGINT;
    v_payment_id UUID;
    v_sanitized_code TEXT;
BEGIN
    -- Get caller UID
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'کاربر وارد نشده است.';
    END IF;

    -- 1. Check if user already has a pending_manual payment
    SELECT EXISTS (
        SELECT 1 
        FROM public.payments 
        WHERE user_id = v_user_id AND status = 'pending_manual'
    ) INTO v_existing_pending;

    IF v_existing_pending THEN
        RAISE EXCEPTION 'شما یک درخواست در انتظار بررسی دارید.';
    END IF;

    -- 2. Fetch Plan details
    SELECT price_irr INTO v_price_irr
    FROM public.plans
    WHERE plan_code = p_plan_code;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'طرح انتخاب شده یافت نشد.';
    END IF;

    -- 3. If discount code provided
    IF p_code IS NOT NULL AND trim(p_code) != '' THEN
        v_sanitized_code := upper(trim(p_code));

        -- Lock the row using FOR UPDATE to prevent concurrency/race conditions
        SELECT id, discount_percent, discount_amount_irr, max_uses, used_count, expires_at
        INTO v_discount_id, v_percent, v_amt_irr, v_max_uses, v_used_count, v_expires_at
        FROM public.discount_codes
        WHERE code = v_sanitized_code
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'کد تخفیف وارد شده معتبر نیست.';
        END IF;

        -- Check expiration
        IF v_expires_at IS NOT NULL AND v_expires_at < now() THEN
            RAISE EXCEPTION 'کد تخفیف وارد شده منقضی شده است.';
        END IF;

        -- Check max uses
        IF v_max_uses IS NOT NULL AND v_used_count >= v_max_uses THEN
            RAISE EXCEPTION 'ظرفیت استفاده از این کد تخفیف به پایان رسیده است.';
        END IF;

        -- Calculate discount
        IF v_percent IS NOT NULL THEN
            v_calc_discount := floor(v_price_irr * v_percent / 100.0)::bigint;
        ELSIF v_amt_irr IS NOT NULL THEN
            v_calc_discount := v_amt_irr;
        END IF;

        v_calc_discount := least(v_price_irr, v_calc_discount);

        -- Increment used counter
        UPDATE public.discount_codes
        SET used_count = used_count + 1
        WHERE id = v_discount_id;

    END IF;

    v_final_amount := v_price_irr - v_calc_discount;

    -- 4. Check if final amount is zero (Zero-priced checkout must use bypass mode/startCheckout instead of manual receipt submit)
    IF v_final_amount = 0 THEN
        RAISE EXCEPTION 'پرداخت کارت به کارت برای مبلغ صفر مجاز نیست. لطفاً از فعال‌سازی رایگان استفاده کنید.';
    END IF;

    -- 5. Insert row in payments
    INSERT INTO public.payments (
        user_id,
        plan_code,
        amount_irr,
        discount_code_id,
        discount_amount_irr,
        final_amount_irr,
        status,
        gateway,
        offline_receipt_url
    )
    VALUES (
        v_user_id,
        p_plan_code,
        v_price_irr,
        v_discount_id,
        v_calc_discount,
        v_final_amount,
        'pending_manual',
        'card_to_card',
        p_receipt_path
    )
    RETURNING id INTO v_payment_id;

    RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Admin RPC activate_manual_subscription: promotes subscripton of verified manual payments
CREATE OR REPLACE FUNCTION public.activate_manual_subscription(
    p_payment_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_payment_status TEXT;
    v_plan_code TEXT;
    v_user_id UUID;
    v_period_days INT;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- 1. Read payment and user ID, and validate state
    SELECT status, plan_code, user_id
    INTO v_payment_status, v_plan_code, v_user_id
    FROM public.payments
    WHERE id = p_payment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'تراکنش پرداخت یافت نشد.';
    END IF;

    IF v_payment_status != 'pending_manual' THEN
        RAISE EXCEPTION 'وضعیت تراکنش برای ارتقای اشتراک نامعتبر است.';
    END IF;

    -- 2. Fetch Plan period
    SELECT period_days INTO v_period_days
    FROM public.plans
    WHERE plan_code = v_plan_code;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'طرح اشتراک مربوطه یافت نشد.';
    END IF;

    -- 3. Update payment status
    UPDATE public.payments
    SET status = 'paid', paid_at = now()
    WHERE id = p_payment_id;

    -- 4. Upsert subscription
    v_expires_at := now() + (interval '1 day' * v_period_days);

    INSERT INTO public.subscriptions (user_id, plan_code, status, started_at, expires_at, updated_at)
    VALUES (v_user_id, v_plan_code, 'active', now(), v_expires_at, now())
    ON CONFLICT (user_id)
    DO UPDATE SET
        plan_code = EXCLUDED.plan_code,
        status = 'active',
        started_at = EXCLUDED.started_at,
        expires_at = EXCLUDED.expires_at,
        updated_at = now();

    -- 5. Reset user usage counter
    INSERT INTO public.usage_counters (user_id, period_start, period_end, request_count, updated_at)
    VALUES (v_user_id, now(), v_expires_at, 0, now())
    ON CONFLICT (user_id)
    DO UPDATE SET
        period_start = EXCLUDED.period_start,
        period_end = EXCLUDED.period_end,
        request_count = 0,
        updated_at = now();

    -- Return true (since coupon was already reserved inside submit_manual_payment)
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Admin RPC reject_manual_payment: rejects a manual payment and rolls back coupon allocation capacity
CREATE OR REPLACE FUNCTION public.reject_manual_payment(
    p_payment_id UUID,
    p_reason TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_payment_status TEXT;
    v_discount_id UUID;
BEGIN
    -- 1. Read payment status and discount_code_id
    SELECT status, discount_code_id
    INTO v_payment_status, v_discount_id
    FROM public.payments
    WHERE id = p_payment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'تراکنش پرداخت یافت نشد.';
    END IF;

    IF v_payment_status != 'pending_manual' THEN
        RAISE EXCEPTION 'وضعیت تراکنش برای رد شدن نامعتبر است.';
    END IF;

    -- 2. Mark as failed and store reason
    UPDATE public.payments
    SET status = 'failed', manual_decline_reason = p_reason
    WHERE id = p_payment_id;

    -- 3. Rollback reserved coupon usage if it had one
    IF v_discount_id IS NOT NULL THEN
        UPDATE public.discount_codes
        SET used_count = greatest(0, used_count - 1)
        WHERE id = v_discount_id;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
