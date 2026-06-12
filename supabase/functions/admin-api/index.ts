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
            email: authUser?.email || authUser?.phone || '',
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

        // Batch Querying: extract unique user IDs to avoid loading all profiles and causing OOM
        const userIds = [...new Set((subs || []).map(sub => sub.user_id).filter(Boolean))];
        let profiles: any[] = [];
        if (userIds.length > 0) {
          const { data: pData, error: pError } = await supabaseService
            .from('profiles')
            .select('*')
            .in('id', userIds);
          if (pError) throw pError;
          if (pData) profiles = pData;
        }

        const { data: plans, error: plErr } = await supabaseService
          .from('plans')
          .select('*');
        if (plErr) throw plErr;

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

        // Batch Querying: extract unique user IDs to avoid OOM from loading all profiles
        const userIds = [...new Set((payments || []).map(p => p.user_id).filter(Boolean))];
        let profiles: any[] = [];
        if (userIds.length > 0) {
          const { data: pData, error: profileErr } = await supabaseService
            .from('profiles')
            .select('*')
            .in('id', userIds);
          if (profileErr) throw profileErr;
          if (pData) profiles = pData;
        }

        // Batch Querying: extract unique coupon/discount code IDs to avoid OOM from loading all discount codes
        const couponIds = [...new Set((payments || []).map(p => p.discount_code_id).filter(Boolean))];
        let coupons: any[] = [];
        if (couponIds.length > 0) {
          try {
            const { data, error } = await supabaseService
              .from('discount_codes')
              .select('*')
              .in('id', couponIds);
            if (!error && data) coupons = data;
          } catch (err) {
            console.warn("Could not retrieve discount_codes defensively:", err);
          }
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

      case 'list_manual_payments': {
        // دریافت لیست تراکنش‌ها با وضعیت pending_manual
        const { data: payments, error: pErr } = await supabaseService
          .from('payments')
          .select('*')
          .eq('status', 'pending_manual')
          .order('created_at', { ascending: false });

        if (pErr) throw pErr;

        const userIds = [...new Set((payments || []).map(p => p.user_id).filter(Boolean))];
        let profiles: any[] = [];
        if (userIds.length > 0) {
          const { data: pData, error: profileErr } = await supabaseService
            .from('profiles')
            .select('*')
            .in('id', userIds);
          if (profileErr) throw profileErr;
          if (pData) profiles = pData;
        }

        // آماده‌سازی DTOها به همراه تولید لینک کوتاه‌عمر خصوصی رسیدها
        const paymentDTOs = [];
        for (const pay of (payments || [])) {
          const profile = (profiles || []).find(p => p.id === pay.user_id);
          
          // پارس کردن مسیر نسبی تصویر از فیلد offline_receipt_url
          let receiptPath = pay.offline_receipt_url || '';
          if (receiptPath.includes('/receipts/')) {
            receiptPath = receiptPath.split('/receipts/')[1];
          }

          let signedUrl = null;
          if (receiptPath) {
            try {
              const { data, error } = await supabaseService.storage
                .from('receipts')
                .createSignedUrl(receiptPath, 600); // لینک موقت ۱۰ دقیقه‌ای
              if (!error && data) {
                signedUrl = data.signedUrl;
              }
            } catch (err) {
              console.error("خطا در ایجاد لینک موقت فیش:", err);
            }
          }

          paymentDTOs.push({
            id: pay.id,
            user_id: pay.user_id,
            amount: Number(pay.final_amount_irr || pay.amount_irr || 0),
            status: 'pending_manual',
            receipt_signed_url: signedUrl,
            created_at: pay.created_at,
            profiles: profile ? {
              id: profile.id,
              display_name: profile.full_name || '',
              avatar_url: profile.avatar_url,
              created_at: profile.created_at
            } : null
          });
        }

        return new Response(JSON.stringify(paymentDTOs), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'approve_manual_payment': {
        const { payment_id } = body;
        if (!payment_id) throw new Error("شناسه تراکنش الزامی است");

        // دریافت لینک رسید جهت حذف فیزیکی پس از اتمام
        const { data: pay, error: fErr } = await supabaseService
          .from('payments')
          .select('offline_receipt_url')
          .eq('id', payment_id)
          .single();
        if (fErr) throw fErr;

        // فراخوانی پروسیجر دیتابیسی
        const { error: rpcErr } = await supabaseService.rpc('activate_manual_subscription', {
          p_payment_id: payment_id
        });
        if (rpcErr) throw rpcErr;

        // حذف بهینه از سطل ذخیره‌سازی receipts
        let receiptPath = pay?.offline_receipt_url || '';
        if (receiptPath.includes('/receipts/')) {
          receiptPath = receiptPath.split('/receipts/')[1];
        }

        if (receiptPath) {
          await supabaseService.storage.from('receipts').remove([receiptPath]);
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'reject_manual_payment': {
        const { payment_id, reason } = body;
        if (!payment_id || !reason) throw new Error("شناسه تراکنش و دلیل رد فیش الزامی است");

        // دریافت لینک رسید جهت حذف از استوریج
        const { data: pay, error: fErr } = await supabaseService
          .from('payments')
          .select('offline_receipt_url')
          .eq('id', payment_id)
          .single();
        if (fErr) throw fErr;

        // فراخوانی پروسیجر دیتابیسی ابطال تراکنش
        const { error: rpcErr } = await supabaseService.rpc('reject_manual_payment', {
          p_payment_id: payment_id,
          p_reason: reason
        });
        if (rpcErr) throw rpcErr;

        // حذف بهینه فیش از استوریج جهت بهینه‌سازی فضا
        let receiptPath = pay?.offline_receipt_url || '';
        if (receiptPath.includes('/receipts/')) {
          receiptPath = receiptPath.split('/receipts/')[1];
        }

        if (receiptPath) {
          await supabaseService.storage.from('receipts').remove([receiptPath]);
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_telegram_settings': {
        const { data, error } = await supabaseService
          .from('telegram_settings')
          .select('*')
          .eq('id', 1)
          .maybeSingle();

        if (error) throw error;

        return new Response(JSON.stringify(data || { id: 1, bot_token: '', chat_id: '', is_enabled: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'save_telegram_settings': {
        const { bot_token, chat_id, is_enabled } = body;
        
        const { error } = await supabaseService
          .from('telegram_settings')
          .upsert({
            id: 1,
            bot_token,
            chat_id,
            is_enabled,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });

        if (error) throw error;

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'list_tickets': {
        const { data: tickets, error: tErr } = await supabaseService
          .from('support_tickets')
          .select('*')
          .order('created_at', { ascending: false });

        if (tErr) throw tErr;

        const userIds = [...new Set((tickets || []).map(t => t.user_id).filter(Boolean))];
        let profiles: any[] = [];
        if (userIds.length > 0) {
          const { data: pData, error: profileErr } = await supabaseService
            .from('profiles')
            .select('*')
            .in('id', userIds);
          if (profileErr) throw profileErr;
          if (pData) profiles = pData;
        }

        const { data: { users }, error: uErr } = await supabaseService.auth.admin.listUsers();
        const usersList = users || [];

        const ticketDTOs = (tickets || []).map(ticket => {
          const profile = (profiles || []).find(p => p.id === ticket.user_id);
          const authUser = usersList.find(u => u.id === ticket.user_id);

          return {
            id: ticket.id,
            user_id: ticket.user_id,
            subject: ticket.subject,
            message: ticket.message,
            status: ticket.status,
            created_at: ticket.created_at,
            profiles: profile ? {
              id: profile.id,
              display_name: profile.full_name || '',
              avatar_url: profile.avatar_url,
              created_at: profile.created_at
            } : null,
            email: authUser?.email || authUser?.phone || ''
          };
        });

        return new Response(JSON.stringify(ticketDTOs), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'marketing_traffic': {
        const { data, error } = await supabaseService
          .schema('marketing')
          .from('mv_traffic_overview')
          .select('*');

        if (error) throw error;

        return new Response(JSON.stringify(data || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'marketing_funnel': {
        const { channel } = body;
        let query = supabaseService
          .schema('marketing')
          .from('mv_funnel_by_channel')
          .select('*');

        if (channel) {
          query = query.eq('channel', channel);
        }

        const { data, error } = await query;
        if (error) throw error;

        return new Response(JSON.stringify(data || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'marketing_purchase_timing': {
        const { channel } = body;
        let query = supabaseService
          .schema('marketing')
          .from('mv_purchase_timing')
          .select('*');

        if (channel) {
          query = query.eq('channel', channel);
        }

        const { data, error } = await query;
        if (error) throw error;

        return new Response(JSON.stringify(data || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'marketing_retention': {
        const { data, error } = await supabaseService
          .schema('marketing')
          .from('mv_retention_by_channel')
          .select('*');

        if (error) throw error;

        return new Response(JSON.stringify(data || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'marketing_roi': {
        const { data, error } = await supabaseService
          .schema('marketing')
          .from('mv_channel_roi')
          .select('*');

        if (error) throw error;

        return new Response(JSON.stringify(data || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'marketing_campaigns': {
        const { data, error } = await supabaseService
          .schema('marketing')
          .from('campaigns_fdw')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        return new Response(JSON.stringify(data || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'marketing_campaign_detail': {
        const { utm_campaign } = body;
        if (!utm_campaign) throw new Error("پارامتر utm_campaign الزامی است");

        const { data, error } = await supabaseService
          .schema('marketing')
          .from('mv_campaign_detail')
          .select('*')
          .eq('utm_campaign', utm_campaign)
          .maybeSingle();

        if (error) throw error;

        return new Response(JSON.stringify(data || null), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'marketing_save_campaign': {
        const { utm_campaign, channel, source_name, start_date, end_date, cost_irr, notes, target_url } = body;
        if (!utm_campaign || !channel) {
          throw new Error("فیلدهای utm_campaign و channel الزامی هستند");
        }

        const payload = {
          utm_campaign,
          channel,
          source_name: source_name || null,
          start_date: start_date || null,
          end_date: end_date || null,
          cost_irr: cost_irr ? Number(cost_irr) : 0,
          currency: 'IRR',
          notes: notes || null,
          target_url: target_url || null,
          created_at: new Date().toISOString()
        };

        // ۱. بررسی وجود کمپین روی جدول خارجی بدون نیاز به تعهد به Constraint یکتا
        const { data: existing, error: checkError } = await supabaseService
          .schema('marketing')
          .from('campaigns_fdw')
          .select('utm_campaign')
          .eq('utm_campaign', utm_campaign)
          .maybeSingle();

        if (checkError) throw checkError;

        let saveError;
        if (existing) {
          // ۲. به‌روزرسانی فیلدهای کمپین ثبت‌شده
          const { error: updateError } = await supabaseService
            .schema('marketing')
            .from('campaigns_fdw')
            .update({
              channel: payload.channel,
              source_name: payload.source_name,
              start_date: payload.start_date,
              end_date: payload.end_date,
              cost_irr: payload.cost_irr,
              currency: payload.currency,
              notes: payload.notes,
              target_url: payload.target_url
            })
            .eq('utm_campaign', utm_campaign);
          saveError = updateError;
        } else {
          // ۳. ایجاد سطر جدید در صورت عدم وجود
          const { error: insertError } = await supabaseService
            .schema('marketing')
            .from('campaigns_fdw')
            .insert(payload);
          saveError = insertError;
        }

        if (saveError) throw saveError;

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
