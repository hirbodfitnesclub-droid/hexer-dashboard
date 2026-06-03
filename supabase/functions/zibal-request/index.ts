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

    const { plan_code } = await req.json();
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

    // Instantiate Service client to allow writing in payments securely (bypass user write RLS constraints)
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

    // Insert pending state into payments (Service Client skips user insert blocker RLS)
    const { data: payment, error: paymentError } = await supabaseService
      .from('payments')
      .insert({
        user_id: user.id,
        plan_code: plan_code,
        amount_irr: plan.price_irr,
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
    const callbackUrl = Deno.env.get('ZIBAL_CALLBACK_URL') || '';

    if (!callbackUrl) {
      console.warn("ZIBAL_CALLBACK_URL environment variable is not defined");
    }

    // Send HTTP POST request to Zibal Request API
    const zibalResponse = await fetch('https://gateway.zibal.ir/v1/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        merchant: merchant,
        amount: Number(plan.price_irr), // Expected to be in RIALS
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
