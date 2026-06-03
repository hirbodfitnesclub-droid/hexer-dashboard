import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

declare const Deno: any;

Deno.serve(async (req: Request) => {
  // 1. CORS Preflight Handler (Must be at the absolute top of the handler)
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // 2. Fallback Secret & Admin Authentication
  const systemSecret = Deno.env.get('ADMIN_API_SECRET') || '3128';
  const adminSecretHeader = req.headers.get('x-admin-secret');

  if (adminSecretHeader !== systemSecret) {
    return new Response(JSON.stringify({ error: "عدم انطباق یا نبود رمز ادمین معتبر" }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // 3. Parse body and check action
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (!action) {
      return new Response(JSON.stringify({ error: "پارامتر action ضروری است" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 4. Create Supabase service role client to bypass Row Level Security constraints
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        }
      }
    );

    // 5. Routing based on action
    switch (action) {
      case 'list_profiles': {
        // Fetch profiles
        const { data: profiles, error: pErr } = await supabaseService
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (pErr) throw pErr;

        // Fetch auth users using Admin API
        const { data: { users }, error: uErr } = await supabaseService.auth.admin.listUsers();
        if (uErr) throw uErr;

        // Perform custom join and map to frontend interface
        const profileDTOs = (profiles || []).map(p => {
          const authUser = users.find(u => u.id === p.id);
          const isBlocked = authUser?.banned_until 
            ? new Date(authUser.banned_until).getTime() > Date.now() 
            : false;

          return {
            id: p.id,
            email: authUser?.email || '',
            display_name: p.full_name || '',
            avatar_url: p.avatar_url || null,
            is_blocked: isBlocked,
            created_at: p.created_at
          };
        });

        return new Response(JSON.stringify(profileDTOs), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'update_profile': {
        const { id, display_name, is_blocked } = body;
        if (!id) throw new Error("شناسه کاربر الزامی است");

        // Update profiles full_name
        const { error: pErr } = await supabaseService
          .from('profiles')
          .update({ full_name: display_name })
          .eq('id', id);

        if (pErr) throw pErr;

        // Update auth banned_until duration
        const banValue = is_blocked ? '876000h' : 'none'; // 100 years or none
        const { error: authErr } = await supabaseService.auth.admin.updateUserById(id, {
          ban_duration: banValue
        });

        if (authErr) throw authErr;

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'list_plans': {
        const { data: plans, error: err } = await supabaseService
          .from('plans')
          .select('*');

        if (err) throw err;

        const planDTOs = (plans || []).map(p => ({
          id: p.plan_code,
          name: p.display_name,
          price: Number(p.price_irr),
          ai_tokens_limit: p.monthly_quota
        }));

        return new Response(JSON.stringify(planDTOs), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'list_subscriptions': {
        // Fetch subscriptions
        const { data: subs, error: sErr } = await supabaseService
          .from('subscriptions')
          .select('*')
          .order('started_at', { ascending: false });

        if (sErr) throw sErr;

        // Fetch companion tables to construct joined DTO objects inside Edge function
        const { data: profiles } = await supabaseService.from('profiles').select('*');
        const { data: plans } = await supabaseService.from('plans').select('*');

        const subDTOs = (subs || []).map(sub => {
          const profile = (profiles || []).find(p => p.id === sub.user_id);
          const plan = (plans || []).find(p => p.plan_code === sub.plan_code);

          const finalProfile = profile ? {
            id: profile.id,
            display_name: profile.full_name || '',
            avatar_url: profile.avatar_url,
            created_at: profile.created_at
          } : null;

          const finalPlan = plan ? {
            id: plan.plan_code,
            name: plan.display_name,
            price: Number(plan.price_irr),
            ai_tokens_limit: plan.monthly_quota
          } : null;

          return {
            id: sub.id,
            user_id: sub.user_id,
            plan_id: sub.plan_code,
            status: sub.status,
            expires_at: sub.expires_at,
            created_at: sub.started_at,
            profiles: finalProfile,
            plans: finalPlan
          };
        });

        return new Response(JSON.stringify(subDTOs), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'upsert_subscription': {
        const { id, user_id, plan_id, status, expires_at, created_at } = body;
        if (!user_id || !plan_id) throw new Error("فیلدهای ضروری خالی است");

        const payload: any = {
          user_id,
          plan_code: plan_id,
          status,
          expires_at,
          started_at: created_at,
          updated_at: new Date().toISOString()
        };

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (id && uuidRegex.test(id)) {
          payload.id = id;
        }

        const { error } = await supabaseService
          .from('subscriptions')
          .upsert(payload, { onConflict: 'user_id' });

        if (error) throw error;

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'list_payments': {
        // Fetch payments
        const { data: payments, error: pErr } = await supabaseService
          .from('payments')
          .select('*')
          .order('created_at', { ascending: false });

        if (pErr) throw pErr;

        // Fetch companion tables defensively
        const { data: profiles } = await supabaseService.from('profiles').select('*');
        
        let coupons: any[] = [];
        try {
          const { data, error } = await supabaseService.from('discount_codes').select('*');
          if (!error && data) coupons = data;
        } catch (err) {
          console.warn("Could not retrieve discount_codes defensively, continuing without coupon join:", err);
        }

        const paymentDTOs = (payments || []).map(pay => {
          const profile = (profiles || []).find(p => p.id === pay.user_id);
          const coupon = coupons.find(c => c.id === pay.discount_code_id);

          return {
            id: pay.id,
            user_id: pay.user_id,
            amount: Number(pay.final_amount_irr || pay.amount_irr || 0),
            status: pay.status === 'paid' ? 'success' : pay.status === 'failed' ? 'failed' : 'pending',
            coupon_code: coupon ? coupon.code : null,
            created_at: pay.created_at,
            profiles: profile ? {
              id: profile.id,
              display_name: profile.full_name || '',
              avatar_url: profile.avatar_url,
              created_at: profile.created_at
            } : null
          };
        });

        return new Response(JSON.stringify(paymentDTOs), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'list_discounts': {
        const { data: discounts, error } = await supabaseService
          .from('discount_codes')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        return new Response(JSON.stringify(discounts || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'save_discount': {
        const discount = body;
        
        const payload: any = {
          code: discount.code.toUpperCase(),
          discount_percent: discount.discount_percent,
          max_uses: discount.max_uses,
          used_count: discount.used_count || 0,
          expires_at: discount.expires_at,
          is_active: discount.is_active !== false,
          created_at: discount.created_at || new Date().toISOString()
        };

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (discount.id && uuidRegex.test(discount.id)) {
          payload.id = discount.id;
        }

        const { error } = await supabaseService
          .from('discount_codes')
          .upsert(payload, { onConflict: 'code' });

        if (error) throw error;

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'delete_discount': {
        const { id } = body;
        if (!id) throw new Error("شناسه کوپن الزامی است");

        const { error } = await supabaseService
          .from('discount_codes')
          .delete()
          .eq('id', id);

        if (error) throw error;

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: `عملیات ${action} پشتیبانی نمی‌شود` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

  } catch (error: any) {
    console.error("موتور گیت‌وی با خطا مواجه شد:", error);
    return new Response(JSON.stringify({ error: error.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
