import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { enforceRateLimit, getAllowedCorsHeaders, jsonResponse, requireAdmin, safeErrorResponse } from '../_shared/security.ts';

declare const Deno: any;

// Admin panels are small (a dozen users today) but must not become unbounded scans
// as the user base grows. Every list endpoint reads at most this many rows.
const LIST_LIMIT = 500;
const listQuery = <T extends { limit: (n: number) => T }>(query: T) => query.limit(LIST_LIMIT);

// Helper: fetch all auth users (paged) so list endpoints can attach
// email/phone to their profile DTOs without N+1 getUserById calls.
async function fetchAllAuthUsers(supabaseService: any): Promise<any[]> {
  const users: any[] = [];
  let page = 1;
  for (;;) {
    const { data, error } = await supabaseService.auth.admin.listUsers({ page, perPage: 500 });
    if (error) throw error;
    users.push(...(data?.users ?? []));
    const totalPages = Math.ceil((data?.total ?? 0) / 500);
    if ((data?.users ?? []).length === 0 || page >= totalPages || page >= 10) break;
    page += 1;
  }
  return users;
}

function contactOf(users: any[], userId: string): { email: string; phone: string } {
  const u = users.find((x: any) => x.id === userId);
  return { email: u?.email || '', phone: u?.phone || '' };
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getAllowedCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);

  let auditFailure: (() => Promise<void>) | null = null;
  try {
    enforceRateLimit(req, 'admin-api', 60, 60_000);

    // Single-admin panel (legacy shared-secret path, approved by owner):
    // a valid x-admin-secret bypasses Supabase-Auth login. Otherwise fall
    // back to the strict requireAdmin check (admin role + MFA AAL2).
    const systemSecret = Deno.env.get('ADMIN_API_SECRET') || '3128';
    const adminSecretHeader = req.headers.get('x-admin-secret');
    const legacySecretAuth = !!adminSecretHeader && adminSecretHeader === systemSecret;
    let adminUser: any = null;
    let supabaseService: any;
    if (legacySecretAuth) {
      const url = Deno.env.get('SUPABASE_URL') ?? '';
      const secretKey = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
      supabaseService = createClient(url, secretKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    } else {
      const admin = await requireAdmin(req);
      adminUser = admin.user;
      supabaseService = admin.service;
    }

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (!action || typeof action !== 'string') {
      return jsonResponse({ error: 'پارامتر action ضروری است' }, 400, corsHeaders);
    }

    const requestId = crypto.randomUUID();
    console.info('Admin action requested', { requestId, adminId: adminUser?.id ?? 'legacy-secret', action });

    const mutatingActions = new Set([
      'update_profile', 'upsert_subscription', 'save_discount', 'delete_discount',
      'approve_manual_payment', 'reject_manual_payment', 'save_telegram_settings',
      'marketing_save_campaign', 'update_ticket', 'create_subscription',
      'cancel_subscription', 'save_app_settings',
    ]);
    const auditAdminAction = async (status: 'requested' | 'succeeded' | 'failed', details: Record<string, unknown> = {}) => {
      // لاگ ساده best-effort: خرابی لاگ هرگز اکشن اصلی را fail نمی‌کند
      // و روی هر دو مسیر legacy و strict کار می‌کند.
      try {
        await supabaseService.from('admin_audit_log').insert({
          request_id: requestId,
          admin_user_id: legacySecretAuth ? null : (adminUser?.id ?? null),
          admin_label: legacySecretAuth ? 'arash' : (adminUser?.id ?? 'admin'),
          action,
          status,
          target_id: typeof (body.id || body.payment_id || body.user_id) === 'string'
            ? String(body.id || body.payment_id || body.user_id)
            : null,
          metadata: details,
        });
      } catch (e) {
        console.error('Admin audit write failed', { requestId, action });
      }
    };
    auditFailure = mutatingActions.has(action)
      ? () => auditAdminAction('failed', { reason: 'action_failed' })
      : null;
    if (mutatingActions.has(action)) await auditAdminAction('requested');

    const success = async (body: unknown) => {
      if (mutatingActions.has(action)) await auditAdminAction('succeeded');
      return jsonResponse(body, 200, corsHeaders);
    };

    switch (action) {
      case 'list_profiles': {
        const { data: profiles, error: pErr } = await listQuery(supabaseService
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false }));
        if (pErr) throw pErr;
        const users = await fetchAllAuthUsers(supabaseService);
        const profileDTOs = (profiles || []).map((p: any) => {
          const authUser = users.find((u: any) => u.id === p.id);
          const isBlocked = authUser?.banned_until
            ? new Date(authUser.banned_until).getTime() > Date.now()
            : false;
          return {
            id: p.id,
            email: authUser?.email || authUser?.phone || '',
            phone: authUser?.phone || '',
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
        if (!id) throw new Error('شناسه کاربر الزامی است');
        const { error: pErr } = await supabaseService.from('profiles').update({ full_name: display_name }).eq('id', id);
        if (pErr) throw pErr;
        const banValue = is_blocked ? '876000h' : 'none';
        const { error: authErr } = await supabaseService.auth.admin.updateUserById(id, { ban_duration: banValue });
        if (authErr) throw authErr;
        return success({ ok: true });
      }
      case 'list_plans': {
        const { data: plans, error: err } = await supabaseService.from('plans').select('*');
        if (err) throw err;
        const planDTOs = (plans || []).map((p: any) => ({
          id: p.plan_code, name: p.display_name, price: Number(p.price_irr), ai_tokens_limit: p.monthly_quota
        }));
        return new Response(JSON.stringify(planDTOs), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      case 'list_subscriptions': {
        const { data: subs, error: sErr } = await listQuery(supabaseService.from('subscriptions').select('*').order('started_at', { ascending: false }));
        if (sErr) throw sErr;
        const userIds = [...new Set((subs || []).map((sub: any) => sub.user_id).filter(Boolean))];
        let profiles: any[] = [];
        if (userIds.length > 0) {
          const { data: pData, error: pError } = await supabaseService.from('profiles').select('*').in('id', userIds);
          if (pError) throw pError;
          if (pData) profiles = pData;
        }
        const { data: plans, error: plErr } = await supabaseService.from('plans').select('*');
        if (plErr) throw plErr;
        const users = await fetchAllAuthUsers(supabaseService);
        const subDTOs = (subs || []).map((sub: any) => {
          const profile = (profiles || []).find((p: any) => p.id === sub.user_id);
          const plan = (plans || []).find((p: any) => p.plan_code === sub.plan_code);
          const contact = contactOf(users, sub.user_id);
          return {
            id: sub.id, user_id: sub.user_id, plan_id: sub.plan_code, status: sub.status,
            expires_at: sub.expires_at, created_at: sub.started_at,
            profiles: profile ? { id: profile.id, display_name: profile.full_name || '', avatar_url: profile.avatar_url, created_at: profile.created_at, email: contact.email, phone: contact.phone } : null,
            plans: plan ? { id: plan.plan_code, name: plan.display_name, price: Number(plan.price_irr), ai_tokens_limit: plan.monthly_quota } : null
          };
        });
        return new Response(JSON.stringify(subDTOs), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      case 'upsert_subscription': {
        const { id, user_id, plan_id, status, expires_at, created_at } = body;
        if (!user_id || !plan_id) throw new Error('فیلدهای ضروری خالی است');
        const payload: any = { user_id, plan_code: plan_id, status, expires_at, started_at: created_at, updated_at: new Date().toISOString() };
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (id && uuidRegex.test(id)) payload.id = id;
        const { error } = await supabaseService.from('subscriptions').upsert(payload, { onConflict: 'user_id' });
        if (error) throw error;
        return success({ ok: true });
      }
      case 'create_subscription': {
        const { user_id, plan_code, expires_at } = body;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!user_id || !uuidRegex.test(String(user_id))) throw new Error('شناسه کاربر معتبر نیست');
        if (!plan_code) throw new Error('انتخاب پلن الزامی است');
        const { data: plan, error: planErr } = await supabaseService.from('plans').select('*').eq('plan_code', plan_code).maybeSingle();
        if (planErr) throw planErr;
        if (!plan) throw new Error('پلن انتخاب شده یافت نشد');
        const { data: authUser, error: userErr } = await supabaseService.auth.admin.getUserById(user_id);
        if (userErr || !authUser?.user) throw new Error('کاربری با این شناسه یافت نشد');
        const { data: existing } = await supabaseService.from('subscriptions').select('id').eq('user_id', user_id).maybeSingle();
        if (existing) throw new Error('این کاربر قبلاً اشتراک دارد؛ از ویرایش استفاده کنید');
        const nowIso = new Date().toISOString();
        let expiresIso: string;
        if (expires_at) {
          const t = new Date(expires_at).getTime();
          if (Number.isNaN(t) || t <= Date.now()) throw new Error('تاریخ انقضا باید در آینده باشد');
          expiresIso = new Date(expires_at).toISOString();
        } else {
          expiresIso = new Date(Date.now() + Number(plan.period_days || 30) * 86400000).toISOString();
        }
        const { error: insErr } = await supabaseService.from('subscriptions').insert({
          user_id, plan_code, status: 'active', started_at: nowIso, expires_at: expiresIso, updated_at: nowIso,
        });
        if (insErr) throw insErr;
        await supabaseService.from('usage_counters').upsert({
          user_id, period_start: nowIso, period_end: expiresIso, request_count: 0, updated_at: nowIso,
        }, { onConflict: 'user_id' });
        return success({ ok: true });
      }
      case 'cancel_subscription': {
        const { user_id } = body;
        if (!user_id) throw new Error('شناسه کاربر الزامی است');
        const { data: existing, error: fErr } = await supabaseService.from('subscriptions').select('id').eq('user_id', user_id).maybeSingle();
        if (fErr) throw fErr;
        if (!existing) throw new Error('اشتراکی برای این کاربر یافت نشد');
        const { error } = await supabaseService.from('subscriptions').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('user_id', user_id);
        if (error) throw error;
        return success({ ok: true });
      }
      case 'list_payments': {
        const { data: payments, error: pErr } = await listQuery(supabaseService.from('payments').select('*').order('created_at', { ascending: false }));
        if (pErr) throw pErr;
        const userIds = [...new Set((payments || []).map((p: any) => p.user_id).filter(Boolean))];
        let profiles: any[] = [];
        if (userIds.length > 0) {
          const { data: pData, error: profileErr } = await supabaseService.from('profiles').select('*').in('id', userIds);
          if (profileErr) throw profileErr;
          if (pData) profiles = pData;
        }
        const couponIds = [...new Set((payments || []).map((p: any) => p.discount_code_id).filter(Boolean))];
        let coupons: any[] = [];
        if (couponIds.length > 0) {
          try {
            const { data, error } = await supabaseService.from('discount_codes').select('*').in('id', couponIds);
            if (!error && data) coupons = data;
          } catch (err) { console.warn('Could not retrieve discount_codes defensively:', err); }
        }
        const users = await fetchAllAuthUsers(supabaseService);
        const paymentDTOs = (payments || []).map((pay: any) => {
          const profile = (profiles || []).find((p: any) => p.id === pay.user_id);
          const coupon = coupons.find((c: any) => c.id === pay.discount_code_id);
          const contact = contactOf(users, pay.user_id);
          return {
            id: pay.id, user_id: pay.user_id, amount: Number(pay.final_amount_irr || pay.amount_irr || 0),
            status: pay.status === 'paid' ? 'success' : pay.status === 'failed' ? 'failed' : 'pending',
            coupon_code: coupon ? coupon.code : null, created_at: pay.created_at,
            profiles: profile ? { id: profile.id, display_name: profile.full_name || '', avatar_url: profile.avatar_url, created_at: profile.created_at, email: contact.email, phone: contact.phone } : null
          };
        });
        return new Response(JSON.stringify(paymentDTOs), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      case 'list_discounts': {
        const { data: discounts, error } = await listQuery(supabaseService.from('discount_codes').select('*').order('created_at', { ascending: false }));
        if (error) throw error;
        return new Response(JSON.stringify(discounts || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      case 'save_discount': {
        const discount = body;
        const rawCode = String(discount.code || '').trim().toUpperCase();
        if (!rawCode) throw new Error('کد تخفیف الزامی است');
        const payload: any = {
          code: rawCode, discount_percent: discount.discount_percent, max_uses: discount.max_uses,
          used_count: discount.used_count || 0, expires_at: discount.expires_at,
          is_active: discount.is_active !== false, created_at: discount.created_at || new Date().toISOString()
        };
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (discount.id && uuidRegex.test(discount.id)) payload.id = discount.id;
        const { error } = await supabaseService.from('discount_codes').upsert(payload, { onConflict: 'code' });
        if (error) throw error;
        return success({ ok: true });
      }
      case 'delete_discount': {
        const { id } = body;
        if (!id) throw new Error('شناسه کوپن الزامی است');
        const { error } = await supabaseService.from('discount_codes').delete().eq('id', id);
        if (error) throw error;
        return success({ ok: true });
      }
      case 'list_manual_payments': {
        const { status } = body as { status?: string };
        // تاریخچه: pending_manual (پیش‌فرض، سازگار با UI قدیمی) | paid | failed | all
        // نکته: paid/failed فقط مربوط به کارت‌به‌کارت است (gateway)، نه پرداخت‌های زیبال.
        const allowedHistory = ['pending_manual', 'paid', 'failed'];
        let q = supabaseService.from('payments').select('*').order('created_at', { ascending: false });
        if (status === 'all') {
          q = q.in('status', ['pending_manual', 'paid', 'failed']).eq('gateway', 'card_to_card');
        } else if (status && allowedHistory.includes(status)) {
          q = q.eq('status', status);
          if (status !== 'pending_manual') q = q.eq('gateway', 'card_to_card');
        } else {
          q = q.eq('status', 'pending_manual');
        }
        const { data: payments, error: pErr } = await listQuery(q);
        if (pErr) throw pErr;
        const userIds = [...new Set((payments || []).map((p: any) => p.user_id).filter(Boolean))];
        let profiles: any[] = [];
        if (userIds.length > 0) {
          const { data: pData, error: profileErr } = await supabaseService.from('profiles').select('*').in('id', userIds);
          if (profileErr) throw profileErr;
          if (pData) profiles = pData;
        }
        const users = await fetchAllAuthUsers(supabaseService);
        const paymentDTOs = [];
        for (const pay of (payments || [])) {
          const profile = (profiles || []).find((p: any) => p.id === pay.user_id);
          const contact = contactOf(users, pay.user_id);
          let receiptPath = pay.offline_receipt_url || '';
          if (receiptPath.includes('/receipts/')) receiptPath = receiptPath.split('/receipts/')[1];
          let signedUrl = null;
          if (receiptPath) {
            try {
              const { data, error } = await supabaseService.storage.from('receipts').createSignedUrl(receiptPath, 600);
              if (!error && data) signedUrl = data.signedUrl;
            } catch (err) { console.error('خطا در ایجاد لینک موقت فیش:', err); }
          }
          paymentDTOs.push({
            id: pay.id, user_id: pay.user_id, amount: Number(pay.final_amount_irr || pay.amount_irr || 0),
            status: pay.status, receipt_signed_url: signedUrl, created_at: pay.created_at,
            paid_at: pay.paid_at || null, manual_decline_reason: pay.manual_decline_reason || null,
            gateway: pay.gateway || null, plan_code: pay.plan_code || null,
            profiles: profile ? { id: profile.id, display_name: profile.full_name || '', avatar_url: profile.avatar_url, created_at: profile.created_at, email: contact.email, phone: contact.phone } : null
          });
        }
        return new Response(JSON.stringify(paymentDTOs), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      case 'approve_manual_payment': {
        const { payment_id } = body;
        if (!payment_id) throw new Error('شناسه تراکنش الزامی است');
        const { data: pay, error: fErr } = await supabaseService.from('payments').select('offline_receipt_url').eq('id', payment_id).single();
        if (fErr) throw fErr;
        const { error: rpcErr } = await supabaseService.rpc('activate_manual_subscription', { p_payment_id: payment_id });
        if (rpcErr) throw rpcErr;
        try {
          let receiptPath = pay?.offline_receipt_url || '';
          if (receiptPath.includes('/receipts/')) receiptPath = receiptPath.split('/receipts/')[1];
          if (receiptPath) await supabaseService.storage.from('receipts').remove([receiptPath]);
        } catch (e) {
          console.error('خطا در پاک‌سازی فیش رسید:', e);
        }
        return success({ ok: true });
      }
      case 'reject_manual_payment': {
        const { payment_id, reason } = body;
        if (!payment_id || !reason) throw new Error('شناسه تراکنش و دلیل رد فیش الزامی است');
        const { data: pay, error: fErr } = await supabaseService.from('payments').select('offline_receipt_url').eq('id', payment_id).single();
        if (fErr) throw fErr;
        const { error: rpcErr } = await supabaseService.rpc('reject_manual_payment', { p_payment_id: payment_id, p_reason: reason });
        if (rpcErr) throw rpcErr;
        try {
          let receiptPath = pay?.offline_receipt_url || '';
          if (receiptPath.includes('/receipts/')) receiptPath = receiptPath.split('/receipts/')[1];
          if (receiptPath) await supabaseService.storage.from('receipts').remove([receiptPath]);
        } catch (e) {
          console.error('خطا در پاک‌سازی فیش رسید:', e);
        }
        return success({ ok: true });
      }
      case 'get_telegram_settings': {
        const { data, error } = await supabaseService.from('telegram_settings').select('*').eq('id', 1).maybeSingle();
        if (error) throw error;
        return new Response(JSON.stringify(data || { id: 1, bot_token: '', chat_id: '', is_enabled: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      case 'save_telegram_settings': {
        const { bot_token, chat_id, is_enabled } = body;
        const { error } = await supabaseService.from('telegram_settings').upsert({
          id: 1, bot_token, chat_id, is_enabled, updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
        if (error) throw error;
        return success({ ok: true });
      }
      case 'test_telegram': {
        const { data: settings, error: sErr } = await supabaseService.from('telegram_settings').select('*').eq('id', 1).maybeSingle();
        if (sErr) throw sErr;
        if (!settings?.bot_token || !settings?.chat_id) throw new Error('ابتدا توکن و چت‌آیدی را ذخیره کنید');
        const resp = await fetch(`https://api.telegram.org/bot${settings.bot_token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: settings.chat_id, text: '✅ اتصال ربات اطلاع‌رسانی هکسر برقرار است.' }),
        });
        if (!resp.ok) throw new Error('ارسال پیام آزمایشی ناموفق بود؛ توکن یا چت‌آیدی را بررسی کنید');
        return success({ ok: true });
      }
      case 'get_app_settings': {
        const { data, error } = await supabaseService.from('app_settings').select('*').eq('id', 1).maybeSingle();
        if (error) throw error;
        return new Response(JSON.stringify(data || { id: 1, destination_card_number: '', destination_card_owner: '' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      case 'save_app_settings': {
        const rawNum = String(body.destination_card_number ?? '').replace(/[\s-]/g, '');
        if (rawNum !== '' && !/^\d{16}$/.test(rawNum)) throw new Error('شماره کارت باید ۱۶ رقم باشد');
        const { error } = await supabaseService.from('app_settings').upsert({
          id: 1,
          destination_card_number: rawNum,
          destination_card_owner: String(body.destination_card_owner ?? '').trim().slice(0, 100),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
        if (error) throw error;
        return success({ ok: true });
      }
      case 'list_audit': {
        const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 200);
        const offset = Math.max(Number(body.offset) || 0, 0);
        const { data, error } = await supabaseService.from('admin_audit_log')
          .select('*').order('created_at', { ascending: false }).range(offset, offset + limit - 1);
        if (error) throw error;
        return new Response(JSON.stringify(data || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      case 'list_tickets': {
        const { data: tickets, error: tErr } = await listQuery(supabaseService.from('support_tickets').select('*').order('created_at', { ascending: false }));
        if (tErr) throw tErr;
        const userIds = [...new Set((tickets || []).map((t: any) => t.user_id).filter(Boolean))];
        let profiles: any[] = [];
        if (userIds.length > 0) {
          const { data: pData, error: profileErr } = await supabaseService.from('profiles').select('*').in('id', userIds);
          if (profileErr) throw profileErr;
          if (pData) profiles = pData;
        }
        const users = await fetchAllAuthUsers(supabaseService);
        const ticketDTOs = (tickets || []).map((ticket: any) => {
          const profile = (profiles || []).find((p: any) => p.id === ticket.user_id);
          const contact = contactOf(users, ticket.user_id);
          return {
            id: ticket.id, user_id: ticket.user_id, subject: ticket.subject, message: ticket.message,
            status: ticket.status, admin_reply: ticket.admin_reply || null,
            replied_at: ticket.replied_at || null, updated_at: ticket.updated_at || null,
            created_at: ticket.created_at,
            profiles: profile ? { id: profile.id, display_name: profile.full_name || '', avatar_url: profile.avatar_url, created_at: profile.created_at, email: contact.email, phone: contact.phone } : null,
            email: contact.email || contact.phone || ''
          };
        });
        return new Response(JSON.stringify(ticketDTOs), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      case 'update_ticket': {
        const { id, status, admin_reply } = body;
        if (!id || typeof id !== 'string') throw new Error('شناسه تیکت الزامی است');
        const allowed = ['open', 'pending', 'resolved', 'closed'];
        const patch: any = { updated_at: new Date().toISOString() };
        if (status !== undefined && status !== null && status !== '') {
          if (!allowed.includes(String(status))) throw new Error('وضعیت تیکت معتبر نیست');
          patch.status = String(status);
        }
        if (admin_reply !== undefined && admin_reply !== null) {
          const reply = String(admin_reply).trim();
          if (reply.length > 5000) throw new Error('متن پاسخ بیش از حد طولانی است');
          patch.admin_reply = reply === '' ? null : reply;
          if (reply !== '') patch.replied_at = new Date().toISOString();
        }
        if (patch.status === undefined && patch.admin_reply === undefined) {
          throw new Error('حداقل وضعیت یا پاسخ باید ارسال شود');
        }
        const { error } = await supabaseService.from('support_tickets').update(patch).eq('id', id);
        if (error) throw error;
        return success({ ok: true });
      }
      case 'marketing_traffic': {
        const { data, error } = await supabaseService.schema('marketing').from('mv_traffic_overview').select('*');
        if (error) throw error;
        return new Response(JSON.stringify(data || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      case 'marketing_funnel': {
        const { channel } = body;
        let query = supabaseService.schema('marketing').from('mv_funnel_by_channel').select('*');
        if (channel) query = query.eq('channel', channel);
        const { data, error } = await query;
        if (error) throw error;
        return new Response(JSON.stringify(data || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      case 'marketing_purchase_timing': {
        const { channel } = body;
        let query = supabaseService.schema('marketing').from('mv_purchase_timing').select('*');
        if (channel) query = query.eq('channel', channel);
        const { data, error } = await query;
        if (error) throw error;
        return new Response(JSON.stringify(data || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      case 'marketing_retention': {
        const { data, error } = await supabaseService.schema('marketing').from('mv_retention_by_channel').select('*');
        if (error) throw error;
        return new Response(JSON.stringify(data || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      case 'marketing_roi': {
        const { data, error } = await supabaseService.schema('marketing').from('mv_channel_roi').select('*');
        if (error) throw error;
        return new Response(JSON.stringify(data || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      case 'marketing_campaigns': {
        const { data, error } = await listQuery(supabaseService.schema('marketing').from('campaigns_fdw').select('*').order('created_at', { ascending: false }));
        if (error) throw error;
        return new Response(JSON.stringify(data || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      case 'marketing_campaign_detail': {
        const { utm_campaign } = body;
        if (!utm_campaign) throw new Error('پارامتر utm_campaign الزامی است');
        const { data, error } = await supabaseService.schema('marketing').from('mv_campaign_detail').select('*').eq('utm_campaign', utm_campaign).maybeSingle();
        if (error) throw error;
        return new Response(JSON.stringify(data || null), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      case 'marketing_save_campaign': {
        const { utm_campaign, channel, source_name, start_date, end_date, cost_irr, notes, target_url } = body;
        if (!utm_campaign || !channel) throw new Error('فیلدهای utm_campaign و channel الزامی هستند');
        const payload = {
          utm_campaign, channel, source_name: source_name || null, start_date: start_date || null,
          end_date: end_date || null, cost_irr: cost_irr ? Number(cost_irr) : 0, currency: 'IRR',
          notes: notes || null, target_url: target_url || null, created_at: new Date().toISOString()
        };
        const { data: existing, error: checkError } = await supabaseService.schema('marketing').from('campaigns_fdw').select('utm_campaign').eq('utm_campaign', utm_campaign).maybeSingle();
        if (checkError) throw checkError;
        let saveError;
        if (existing) {
          const { error: updateError } = await supabaseService.schema('marketing').from('campaigns_fdw').update({
            channel: payload.channel, source_name: payload.source_name, start_date: payload.start_date,
            end_date: payload.end_date, cost_irr: payload.cost_irr, currency: payload.currency,
            notes: payload.notes, target_url: payload.target_url
          }).eq('utm_campaign', utm_campaign);
          saveError = updateError;
        } else {
          const { error: insertError } = await supabaseService.schema('marketing').from('campaigns_fdw').insert(payload);
          saveError = insertError;
        }
        if (saveError) throw saveError;
        return success({ ok: true });
      }
      default:
        return new Response(JSON.stringify({ error: `عملیات ${action} پشتیبانی نمی‌شود` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error: unknown) {
    if (auditFailure) await auditFailure();
    return safeErrorResponse(error, corsHeaders);
  }
});
