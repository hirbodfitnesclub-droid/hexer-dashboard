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
    let trackId = "";

    // Parse trackId from POST request body first
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        trackId = String(body.trackId || body.track_id || "");
      } catch (e) {
        // Body might be empty
      }
    }

    // Fallback to query string parameters if body parsing didn't find it
    if (!trackId) {
      const url = new URL(req.url);
      trackId = url.searchParams.get('trackId') || url.searchParams.get('track_id') || "";
    }

    if (!trackId) {
      return new Response(JSON.stringify({ error: "Missing trackId or track_id" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Instantiate Service client to allow reading and updating payments table by-passing RLS restraints
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Search for the transaction trace in the database
    const { data: paymentRecord, error: searchError } = await supabaseService
      .from('payments')
      .select('*')
      .eq('track_id', trackId)
      .maybeSingle();

    if (searchError) {
      console.error("Database search error:", searchError);
      throw new Error(`Failed to retrieve payment record: ${searchError.message}`);
    }

    if (!paymentRecord) {
      return new Response(JSON.stringify({ error: "Transaction trackId not found in local database" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404
      });
    }

    // 2. Check for duplicate processing (Idempotency Guard)
    if (paymentRecord.status === 'paid') {
      console.log(`Payment with trackId ${trackId} is already completed/paid.`);
      return new Response(JSON.stringify({
        status: "success",
        message: "Already processed",
        plan_code: paymentRecord.plan_code
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    const merchant = Deno.env.get('ZIBAL_MERCHANT') || 'zibal';

    // 3. Dispatch verification request to Zibal gateway API
    const zibalVerifyResponse = await fetch('https://gateway.zibal.ir/v1/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        merchant: merchant,
        trackId: Number(trackId)
      })
    });

    if (!zibalVerifyResponse.ok) {
      throw new Error(`Zibal verify gateway returned HTTP ${zibalVerifyResponse.status}`);
    }

    const zibalResult = await zibalVerifyResponse.json();
    console.log("Zibal API verification output:", JSON.stringify(zibalResult));

    // result meanings:
    // 100: Successfully Verified
    // 101/201: Already Verified in the past (also valid success)
    const isSuccess = zibalResult.result === 100 || zibalResult.result === 101 || zibalResult.result === 201;

    if (isSuccess) {
      const refNumber = String(zibalResult.refNumber || "");

      // 4a. Update status to paid and log reference number
      const { error: updateError } = await supabaseService
        .from('payments')
        .update({
          status: 'paid',
          ref_number: refNumber,
          paid_at: new Date().toISOString()
        })
        .eq('id', paymentRecord.id);

      if (updateError) {
        console.error("Local payment update success-state error:", updateError);
        throw new Error("Failed to record transaction status as paid in local database");
      }

      // 4b. Call DB RPC to activate subscription and reset usage counters atomically
      const { data: activeSuccess, error: activeError } = await supabaseService.rpc('activate_subscription', {
        p_user_id: paymentRecord.user_id,
        p_plan_code: paymentRecord.plan_code,
        p_payment_id: paymentRecord.id
      });

      if (activeError) {
        console.error("RPC activate_subscription failed:", activeError);
        throw new Error(`Failed to activate subscription atomically in DB: ${activeError.message}`);
      }

      return new Response(JSON.stringify({
        status: "success",
        plan_code: paymentRecord.plan_code,
        refNumber: refNumber
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });

    } else {
      // payment failed or was canceled
      const { error: updateError } = await supabaseService
        .from('payments')
        .update({
          status: 'failed'
        })
        .eq('id', paymentRecord.id);

      if (updateError) {
        console.error("Local payment update fail-state error:", updateError);
      }

      return new Response(JSON.stringify({
        status: "failed",
        message: zibalResult.message || `Verification declined by Zibal with code ${zibalResult.result}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

  } catch (error) {
    console.error("Zibal Verification Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
