import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

declare const Deno: any;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    const { plan_code, discount_code } = await req.json();
    if (!plan_code) {
      return new Response(JSON.stringify({ error: "Missing plan_code" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Identify user with the authentication credentials provided in the request
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    // Instantiate Service client to allow reading/writing in DB by-passing RLS constraints
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch Plan Details from DB, amount_irr is kept strictly server-determined
    const { data: plan, error: planError } = await supabaseService
      .from('plans')
      .select('price_irr, display_name')
      .eq('plan_code', plan_code)
      .single();

    if (planError || !plan) {
      console.error("Plan retrieval error:", planError);
      return new Response(JSON.stringify({ error: `Selected plan (${plan_code}) not found` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404
      });
    }

    const planPrice = Number(plan.price_irr);
    let discountAmount = 0;
    let discountCodeId: string | null = null;

    // Validate and process discount code if provided
    if (discount_code && typeof discount_code === 'string' && discount_code.trim() !== '') {
      const sanitizedCode = discount_code.toUpperCase().trim();
      const { data: discountRecord, error: dcError } = await supabaseService
        .from('discount_codes')
        .select('*')
        .eq('code', sanitizedCode)
        .maybeSingle();

      if (dcError) {
        console.error("Discount lookup error:", dcError);
        return new Response(JSON.stringify({ error: "خطا در بررسی کد تخفیف." }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        });
      }

      if (!discountRecord) {
        return new Response(JSON.stringify({ error: "کد تخفیف وارد شده معتبر نیست." }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        });
      }

      // 1. Check expiration date
      if (discountRecord.expires_at && new Date(discountRecord.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: "کد تخفیف وارد شده منقضی شده است." }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        });
      }

      // 2. Check maximum uses limit
      if (discountRecord.max_uses !== null && discountRecord.used_count >= discountRecord.max_uses) {
        return new Response(JSON.stringify({ error: "ظرفیت استفاده از این کد تخفیف به پایان رسیده است." }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        });
      }

      discountCodeId = discountRecord.id;

      // 3. Calculate dynamic discount amounts
      if (discountRecord.discount_percent !== null) {
        discountAmount = Math.floor(planPrice * (discountRecord.discount_percent / 100));
      } else if (discountRecord.discount_amount_irr !== null) {
        discountAmount = Number(discountRecord.discount_amount_irr);
      }

      // Cap discount amount to avoid negative prices
      discountAmount = Math.min(planPrice, discountAmount);
    }

    const finalAmount = planPrice - discountAmount;

    // Guardrail 1: Transaction bottom threshold checkout validation
    // If greater than 0 but less than 10000 Rials (1000 Tomans), throw standard banking network minimum limit exception
    if (finalAmount > 0 && finalAmount < 10000) {
      return new Response(JSON.stringify({ 
        error: "مبلغ نهایی پس از اعمال تخفیف، کمتر از حداقل مجاز شبکه بانکی (۱۰۰۰ تومان) است." 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    const callbackUrl = Deno.env.get('ZIBAL_CALLBACK_URL') || '';
    if (!callbackUrl) {
      console.warn("ZIBAL_CALLBACK_URL environment variable is not defined");
    }

    // Guardrail 1: Complete discount bypass
    // If final amount is 0, process as a free option bypassing payment gateways entirely
    if (finalAmount === 0) {
      const uniqueBypassId = `free_bypass_${crypto.randomUUID()}`;

      // Insert order log as pending
      const { data: payment, error: paymentError } = await supabaseService
        .from('payments')
        .insert({
          user_id: user.id,
          plan_code: plan_code,
          amount_irr: planPrice,
          discount_code_id: discountCodeId,
          discount_amount_irr: discountAmount,
          final_amount_irr: finalAmount,
          status: 'pending',
          gateway: 'bypass',
          track_id: uniqueBypassId
        })
        .select('id')
        .single();

      if (paymentError || !payment) {
        console.error("Bypass insert error:", paymentError);
        throw new Error(`Failed to initialize bypass payment: ${paymentError?.message || 'unknown error'}`);
      }

      // Direct feedback redirection target with local verification parameter
      const bypassRedirectionUrl = callbackUrl + (callbackUrl.includes('?') ? '&' : '?') + `trackId=${uniqueBypassId}`;

      return new Response(JSON.stringify({
        payUrl: bypassRedirectionUrl
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Standard Gateway workflow (finalAmount >= 10000 Rials)
    const { data: payment, error: paymentError } = await supabaseService
      .from('payments')
      .insert({
        user_id: user.id,
        plan_code: plan_code,
        amount_irr: planPrice,
        discount_code_id: discountCodeId,
        discount_amount_irr: discountAmount,
        final_amount_irr: finalAmount,
        status: 'pending',
        gateway: 'zibal'
      })
      .select('id')
      .single();

    if (paymentError || !payment) {
      console.error("Payment insert error:", paymentError);
      throw new Error(`Failed to initialize payment: ${paymentError?.message || 'unknown error'}`);
    }

    const orderId = payment.id;
    const merchant = Deno.env.get('ZIBAL_MERCHANT') || 'zibal';

    // Send HTTP POST request to Zibal Request API using the final discounted price
    const zibalResponse = await fetch('https://gateway.zibal.ir/v1/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        merchant: merchant,
        amount: Number(finalAmount), // Expected to be in RIALS after discount
        callbackUrl: callbackUrl,
        description: `خرید اشتراک هکسر طرح ${plan.display_name}`,
        orderId: orderId
      })
    });

    if (!zibalResponse.ok) {
      throw new Error(`Zibal request gateway returned HTTP ${zibalResponse.status}`);
    }

    const zibalResult = await zibalResponse.json();
    console.log("Zibal API request output:", JSON.stringify(zibalResult));

    if (zibalResult.result === 100) {
      const trackId = String(zibalResult.trackId);
      
      // Update dynamic payment trace with the received trackId
      const { error: updateError } = await supabaseService
        .from('payments')
        .update({ track_id: trackId })
        .eq('id', orderId);

      if (updateError) {
        console.error("Failed to update track_id in database:", updateError);
        throw new Error("Local database synchronization failed during payment initiation");
      }

      // Return Zibal checkout redirection endpoint
      return new Response(JSON.stringify({
        payUrl: `https://gateway.zibal.ir/start/${trackId}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });

    } else {
      return new Response(JSON.stringify({
        error: `Zibal request failed with code ${zibalResult.result}`,
        message: zibalResult.message || "Failed to contact Zibal gateway"
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

  } catch (error) {
    console.error("Zibal Request Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
