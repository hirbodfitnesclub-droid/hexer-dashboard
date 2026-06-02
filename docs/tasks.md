# tasks.md — نقشه راه مرجع (Hexer Admin Panel)

> ترتیب اجرا اجباری و متوالی است. تسک‌هایی که روی فایل‌های یکسان می‌نویسند موازی نشده‌اند.
> هر تسک فقط کارهای محدوده‌ی خودش را انجام دهد. کدنویس: ساده، مدرن، بدون over-engineering.

---

## TASK 1 — افزودن ستون `is_active` به جدول کدهای تخفیف (Migration)

**راهنمای پیاده‌سازی فنی:**
1. فایل جدید `supabase/sql/24_admin_dashboard_patch.sql` ساخته شود (idempotent).
2. `ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;`
3. (اختیاری) backfill: ردیف‌های منقضی‌شده می‌توانند `is_active = false` شوند؛ اما ساده نگه دارید — پیش‌فرض `true` کافی است.
4. در انتهای فایل: `NOTIFY pgrst, 'reload schema';`

**محدودیت‌های اختصاصی تسک:**
- ✅ فقط همین یک ستون اضافه شود. ✅ فایل کاملاً idempotent باشد (`IF NOT EXISTS`).
- ❌ هیچ فایل SQL موجودی ویرایش نشود. ❌ به مدل RLS دست نزنید. ❌ ستون‌های دیگر اضافه نکنید.
- ⚠️ این فایل باید توسط مالک در SQL Editor سوپابیس اجرا شود (کدنویس فقط فایل را تولید می‌کند).

CONTEXT_FILES: ["supabase/sql/23_add_discount_system.sql"]

---

## TASK 2 — ساخت Edge Function به‌نام `admin-api` (Gateway امنِ ادمین)

**راهنمای پیاده‌سازی فنی:**
1. فایل `supabase/functions/admin-api/index.ts` با الگوی `Deno.serve` ساخته شود (دقیقاً مطابق سبک `zibal-verify/index.ts`).
2. هندل `OPTIONS` برای CORS (از `_shared/cors.ts`).
3. در ابتدای هر درخواست: هدر `x-admin-secret` با `Deno.env.get('ADMIN_API_SECRET')` مقایسه شود؛ در صورت عدم تطابق → `401`.
4. ساخت کلاینت: `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` (bypass RLS).
5. بر اساس `body.action` روتینگ شود؛ تمام actionها طبق جدول ARCHITECTURE.md پیاده شوند:
   - `list_profiles`: ردیف‌های `profiles` + فراخوانی `supabaseService.auth.admin.listUsers()` برای استخراج `email` و `banned_until`؛ ادغام در DTO با کلیدهای `{ id, display_name (=full_name), email, avatar_url, is_blocked (= banned_until در آینده), created_at }`.
   - `update_profile`: آپدیت `profiles.full_name`؛ و برای مسدودسازی، `auth.admin.updateUserById(id, { ban_duration: is_blocked ? '876000h' : 'none' })`.
   - `list_plans`: نگاشت `plan_code→id, display_name→name, price_irr→price, monthly_quota→ai_tokens_limit`.
   - `list_subscriptions`: subscriptions + الصاق پروفایل و پلن سمت سرور؛ کلیدها `{ id, user_id, plan_id (=plan_code), status, expires_at, created_at (=started_at), profiles, plans }`.
   - `upsert_subscription`: upsert در `subscriptions` با `onConflict: 'user_id'`.
   - `list_payments`: payments + الصاق پروفایل + resolve کد تخفیف؛ `amount = amount_irr`، نگاشت `paid→success`، `coupon_code` از join.
   - `list_discounts`: select مستقیم.
   - `save_discount`: اگر idِ معتبر UUID نبود، آن را حذف کن و بگذار DB تولید کند؛ upsert با `onConflict: 'code'`.
   - `delete_discount`: حذف بر اساس id.
6. همه‌ی خروجی‌ها `{ ...corsHeaders, 'Content-Type': 'application/json' }` و کدهای وضعیت مناسب.

**محدودیت‌های اختصاصی تسک:**
- ✅ فقط service_role در این فایل (سمت سرور). ✅ شکل خروجی **دقیقاً** منطبق با interfaceهای `src/lib/supabase.ts`.
- ✅ مدیریت خطا با try/catch و پیام فارسی کوتاه.
- ❌ هیچ تغییری در فرانت در این تسک انجام نشود. ❌ منطق پرداخت/Zibal لمس نشود. ❌ کلید secret هاردکد نشود؛ از `Deno.env` خوانده شود.
- ⚠️ دیپلوی با `supabase functions deploy admin-api --no-verify-jwt` و ست‌کردن `ADMIN_API_SECRET` بر عهده‌ی مالک است.

CONTEXT_FILES: ["supabase/functions/zibal-verify/index.ts", "supabase/functions/_shared/cors.ts", "supabase/functions/_shared/auth-guard.ts", "src/lib/supabase.ts", "supabase/sql/01_profiles.sql", "supabase/sql/02_billing.sql", "supabase/sql/04_payments.sql", "supabase/sql/23_add_discount_system.sql"]

---

## TASK 3 — بازنویسی لایه‌ی داده‌ی فرانت برای استفاده از Gateway

**راهنمای پیاده‌سازی فنی:**
1. `src/lib/supabase.ts`:
   - حذف کامل `createClient` با کلید secret و خود ثابتِ `supabaseServiceKey`.
   - نگه‌داشتن و اصلاح interfaceها: `Profile` شامل `display_name`, `email?`, `is_blocked?`, `avatar_url`, `created_at`. (این‌ها همان شکل DTO خروجی Gateway هستند.)
   - این فایل دیگر فقط «تایپ‌ها» را export می‌کند (و در صورت نیاز آینده، یک کلاینت با کلید **publishable** — نه secret).
2. `src/lib/dataStore.ts`:
   - تعریف ثابت‌های بالای فایل: `GATEWAY_URL = `${supabaseUrl}/functions/v1/admin-api`` و `ADMIN_SECRET = '<رمز ثابت>'` (هاردکد مجاز).
   - بازنویسی متد `request` تا به‌جای PostgREST، یک `POST` به `GATEWAY_URL` با هدر `x-admin-secret` و بدنه‌ی `{ action, ...payload }` بزند.
   - نگاشت همه‌ی متدهای موجود (`getProfiles`, `updateProfile`, `getPlans`, `getSubscriptions`, `saveSubscription`, `getPayments`, `getDiscountCodes`, `saveDiscountCode`, `deleteDiscountCode`) به actionهای متناظر Gateway. امضای متدها (ورودی/خروجی) بدون تغییر بماند تا صفحات نشکنند.
   - join سمت کلاینت حذف شود (حالا سرور join می‌کند) — کد ساده‌تر می‌شود.
   - پیام‌های toast فعلی حفظ شوند.

**محدودیت‌های اختصاصی تسک:**
- ✅ امضای public متدهای `dataStore` ثابت بماند. ✅ کلید secret کاملاً حذف شود.
- ❌ صفحات/کامپوننت‌ها در این تسک ویرایش نشوند (به‌جز اگر تغییر تایپ اجباری کند). ❌ هیچ fetch مستقیمی به `/rest/v1` نماند.

CONTEXT_FILES: ["src/lib/supabase.ts", "src/lib/dataStore.ts", "src/pages/Dashboard.tsx", "src/pages/UsersManager.tsx", "src/pages/SubscriptionsManager.tsx", "src/pages/DiscountsManager.tsx"]

---

## TASK 4 — هم‌سوسازی UI با داده‌ی اصلاح‌شده و رفع باگ‌های جزئی

**راهنمای پیاده‌سازی فنی:**
1. `src/components/ui/DiscountCreateModal.tsx`: فیلد `id: 'dis-...'` از آبجکت `newDiscount` حذف شود (id را Gateway/DB می‌سازد). در صورت لزوم تایپ را `Omit<DiscountCode,'id'>` یا id اختیاری کنید.
2. `src/pages/Dashboard.tsx`: تأیید شود که محاسبات با DTO جدید درست کار می‌کنند (`pay.status === 'success'`, `pay.amount`, `dis.is_active`). چون Gateway نگاشت می‌کند، نباید تغییری لازم باشد؛ فقط در صورت خطا اصلاح شود.
3. `src/App.tsx`: در `toastOptions.style.fontFamily` رشته‌ی نادرست `'Vazirmatn, system-ui, sans-serif animate-pulse'` به `'Vazirmatn, system-ui, sans-serif'` اصلاح شود (کلمه‌ی `animate-pulse` اشتباهاً داخل مقدار فونت آمده).
4. `src/components/charts/RevenueChart.tsx`, `UserGrowthChart.tsx`, `PlanDistributionChart.tsx`: مطمئن شوید کانتینرِ هر `ResponsiveContainer` ارتفاع پیکسلیِ مشخص دارد (مثل الگوی موجود در RevenueChart: `style={{ width:'100%', height:300, minWidth:0 }}`) تا اخطار `width(-1)/height(-1)` رفع شود. به‌خصوص PlanDistributionChart و UserGrowthChart بررسی شوند.

**محدودیت‌های اختصاصی تسک:**
- ✅ فقط اصلاحات نقطه‌ای فهرست‌شده. ✅ تغییرات حداقلی و بصریِ بی‌ریسک.
- ❌ بازطراحی UI یا تغییر استایل کلی ممنوع. ❌ تغییر منطق دیتافچینگ (مال تسک ۳ است).

CONTEXT_FILES: ["src/components/ui/DiscountCreateModal.tsx", "src/pages/Dashboard.tsx", "src/App.tsx", "src/components/charts/RevenueChart.tsx", "src/components/charts/UserGrowthChart.tsx", "src/components/charts/PlanDistributionChart.tsx", "src/lib/supabase.ts"]

---

## دنباله‌ی اجرا و دلیل ترتیب
1. **TASK 1** پایه‌ی اسکیما (`is_active`) را آماده می‌کند تا Gateway بتواند آن را بازگرداند.
2. **TASK 2** سرور را می‌سازد (وابسته به اسکیمای تسک ۱).
3. **TASK 3** فرانت را به سرور وصل می‌کند (وابسته به قرارداد تسک ۲).
4. **TASK 4** UI را با داده‌ی جدید هم‌سو و باگ‌های جزئی را رفع می‌کند (وابسته به تسک ۳).

> تسک‌های ۲ و ۳ هر دو `src/lib/supabase.ts` را می‌خوانند ولی فقط تسک ۳ آن را می‌نویسد؛ پس موازی‌سازی ممنوع و ترتیب باید رعایت شود.
