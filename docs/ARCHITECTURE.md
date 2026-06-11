# ARCHITECTURE.md — لنگرگاه سیستمی (Hexer Admin Panel)

> این پروژه از قبل موجود است؛ پس درخت فایل کامل بازترسیم نمی‌شود. فقط منطق مسیردهی، اسکیمای مرتبط، جریان داده‌ی جدید و مسیر دقیق فایل‌هایی که باید ساخته/ویرایش شوند مشخص می‌گردد.

---

## ۱. اسکیمای دیتابیس (فقط جداولِ مرتبط با پنل)

منبع حقیقت: فایل‌های `supabase/sql/*.sql`. خلاصه‌ی ستون‌هایی که پنل با آن‌ها سروکار دارد:

### `auth.users` (مدیریت‌شده توسط Supabase Auth)
- `id UUID`, `email TEXT`, `banned_until TIMESTAMPTZ` (مبنای وضعیت «مسدود»), `raw_user_meta_data JSONB`.
- **فقط با service_role / Admin API قابل خواندن است. از PostgREST در دسترس نیست.**

### `public.profiles`
- `id UUID PK → auth.users.id`
- `full_name TEXT`  ← ⚠️ نامِ واقعی ستون (نه `display_name`)
- `avatar_url TEXT`, `timezone TEXT`, `onboarding_completed BOOL`, `specialty TEXT`, `interests TEXT[]`
- `created_at`, `updated_at`
- **هیچ ستون `email` یا `is_blocked` ندارد.**

### `public.plans`
- `plan_code TEXT PK` (`free` | `plus` | `pro`), `display_name`, `price_irr BIGINT`, `monthly_quota INT`, `period_days INT`, `ai_model TEXT`

### `public.subscriptions`
- `id UUID PK`, `user_id UUID UNIQUE → auth.users`, `plan_code TEXT → plans`, `status TEXT` (`active`/`expired`/`canceled`), `started_at`, `expires_at`, `updated_at`
- ⚠️ `user_id` یکتاست → upsert باید با `on_conflict=user_id` انجام شود.

### `public.payments`
- `id UUID PK`, `user_id UUID`, `plan_code TEXT`, `amount_irr BIGINT`, `gateway`, `track_id`, `ref_number`, `status TEXT` (`pending`/`paid`/`failed`/`canceled`), `created_at`, `paid_at`
- `discount_code_id UUID → discount_codes(id)`, `discount_amount_irr BIGINT`, `final_amount_irr BIGINT`
- ⚠️ مبلغ = `amount_irr`؛ موفق = `paid` (نه `success`)؛ کد تخفیف از طریق join با `discount_codes` به‌دست می‌آید (ستون `coupon_code` وجود ندارد).

### `public.discount_codes`
- `id UUID PK`, `code TEXT UNIQUE`, `discount_percent INT NULL`, `discount_amount_irr BIGINT NULL`, `max_uses INT NULL`, `used_count INT`, `expires_at`, `created_at`
- ⚠️ **ستون `is_active` وجود ندارد** ولی UI به آن نیاز دارد → در migration جدید اضافه می‌شود.
- محدودیت: دقیقاً یکی از `discount_percent` یا `discount_amount_irr` باید مقدار داشته باشد (UI فعلاً فقط درصدی می‌سازد).

> سایر جداول (`projects`, `tasks`, `notes`, `habits`, `chat_sessions`, ...) مربوط به خودِ اپ Second Brain‌اند و **در scope این پنل نیستند**.

---

## ۲. عدم‌تطابق‌های اسکیما ↔ تایپ فرانت (منشأ بخش بزرگی از باگ‌ها)

| تایپ فرانت (`src/lib/supabase.ts`) | فیلد استفاده‌شده | واقعیت دیتابیس | استراتژی حل |
|---|---|---|---|
| `Profile.display_name` | UserRow، Subscription، جستجو | ستون `full_name` | Gateway در DTO، `display_name` را از `full_name` پر می‌کند |
| `Profile.email` | همه‌جا | فقط در `auth.users` | Gateway از `auth.admin.listUsers` می‌خواند و الصاق می‌کند |
| `Profile.is_blocked` | UserRow، فیلتر، Block | از `banned_until` در auth | Gateway آن را محاسبه و در DTO قرار می‌دهد |
| `Payment.amount` | Dashboard، RecentPayments | ستون `amount_irr`/`final_amount_irr` | Gateway مقدار را در `amount` نگاشت می‌کند |
| `Payment.status === 'success'` | محاسبه‌ی درآمد | مقدار واقعی `paid` | Gateway `paid`→`success` را map می‌کند |
| `Payment.coupon_code` | RecentPayments | از join با `discount_codes` | Gateway کد را resolve و الصاق می‌کند |
| `DiscountCode.is_active` | DiscountRow، toggle، Dashboard | ستون وجود ندارد | افزودن ستون در migration + بازگردانی در DTO |
| `DiscountCode.id = "dis-xxx"` | ساخت کد | باید UUID باشد | Gateway هنگام create، id کلاینت را نادیده می‌گیرد |

**اصل طراحی:** Edge Function نقش **Anti-Corruption Layer** را دارد؛ شکل خروجی دقیقاً مطابق interfaceهای موجود فرانت است تا تغییرات UI حداقلی بماند.

---

## ۳. مسیردهی API و جریان داده (طراحی جدید)

### قبل (خراب)
```
React (browser)  ──fetch با sb_secret──►  Supabase PostgREST  ✗ BLOCKED
```

### بعد (هدف)
```
React (browser)
  │  fetch + هدر X-Admin-Secret  (بدون هیچ کلید secret سوپابیس)
  ▼
Supabase Edge Function: admin-api   (Deno, deployed با --no-verify-jwt)
  │  - بررسی X-Admin-Secret
  │  - createClient با SUPABASE_SERVICE_ROLE_KEY  (bypass RLS)
  │  - auth.admin.listUsers / updateUserById برای email و ban
  │  - نگاشت داده به DTO منطبق با تایپ‌های فرانت
  ▼
Postgres (همه‌ی ردیف‌ها، بدون محدودیت RLS)
```

### قرارداد Endpointهای `admin-api` (روتینگ داخل یک فانکشن بر اساس `action`)
بدنه‌ی JSON با فیلد `action` ارسال می‌شود (الگوی RPC ساده، CORS طبق `_shared/cors.ts`):

| action | ورودی | خروجی (DTO) | عملیات سرور |
|---|---|---|---|
| `list_profiles` | — | `Profile[]` | join پروفایل‌ها + ایمیل/ban از auth |
| `update_profile` | `{id, full_name, is_blocked}` | `{ok}` | update `profiles.full_name` + `auth.admin.updateUserById(ban_duration)` |
| `list_plans` | — | `Plan[]` | select از `plans` |
| `list_subscriptions` | — | `Subscription[]` | subscriptions + join پروفایل/پلن |
| `upsert_subscription` | `Subscription` | `{ok}` | upsert با `on_conflict=user_id` |
| `list_payments` | — | `Payment[]` | payments + join پروفایل/کدتخفیف + map وضعیت |
| `list_discounts` | — | `DiscountCode[]` | select از `discount_codes` |
| `save_discount` | `DiscountCode` | `{ok}` | create (بدون id کلاینت) یا update |
| `delete_discount` | `{id}` | `{ok}` | delete |

> نکته‌ی امنیتی واقع‌بینانه: چون محیط خصوصی است، `--no-verify-jwt` + رمز ادمینِ ساده کافی است. نیازی به سشن واقعی سوپابیس برای ادمین نیست. منطق لاگین فعلی (`arash`/`3128` در `adminStore.ts`) دست‌نخورده می‌ماند.

---

## ۴. قوانین درخت فایل (منطق مسیردهی)

- **لایه‌ی داده‌ی فرانت:** فقط `src/lib/dataStore.ts` (کلاینت Gateway) و `src/lib/supabase.ts` (فقط تایپ‌ها + در صورت نیاز کلاینت publishable برای آینده). هیچ کامپوننتی نباید مستقیم fetch بزند.
- **پیکربندی/ثابت‌ها:** URL سوپابیس و رمز ادمین به‌صورت ثابت در بالای `dataStore.ts` (هاردکد مجاز، فقط رمز ادمین — نه کلید secret).
- **Edge Functions:** هر فانکشن یک پوشه زیر `supabase/functions/<name>/index.ts`؛ کدِ مشترک در `supabase/functions/_shared/`.
- **Migrationها:** هر تغییر اسکیمایی، یک فایل **جدید و idempotent** زیر `supabase/sql/` با شماره‌ی بعدی (`24_...`). فایل‌های قبلی ویرایش نمی‌شوند. در پایان `NOTIFY pgrst, 'reload schema';`.
- **UI:** صفحات در `src/pages/`، اجزای ریز در `src/components/ui/`، نمودارها در `src/components/charts/`، لایه‌ها در `src/components/layout/`.

### فایل‌هایی که ساخته می‌شوند
- `supabase/sql/24_admin_dashboard_patch.sql`  (افزودن `is_active` به `discount_codes`)
- `supabase/functions/admin-api/index.ts`  (Gateway ادمین)

### فایل‌هایی که ویرایش می‌شوند
- `src/lib/supabase.ts`  (حذف کلاینت secret؛ اصلاح interfaceها)
- `src/lib/dataStore.ts`  (تغییر کل لایه به فراخوانی Gateway)
- `src/components/ui/DiscountCreateModal.tsx`  (حذف idِ ساختگی)
- `src/pages/Dashboard.tsx`  (تأیید محاسبات با DTO جدید)
- `src/App.tsx`  (اصلاح باگ `fontFamily`)
- `src/components/charts/*.tsx`  (تثبیت ارتفاع کانتینر برای رفع اخطار recharts)

---

## ۵. متغیرها / Secrets

### سمت Edge Function (در داشبورد سوپابیس → Edge Functions → Secrets)
- `SUPABASE_URL` (به‌صورت پیش‌فرض موجود است)
- `SUPABASE_SERVICE_ROLE_KEY` (به‌صورت پیش‌فرض در محیط Edge موجود است)
- `ADMIN_API_SECRET` (یک رشته‌ی تصادفی که باید ست شود)

### سمت فرانت
- `VITE_SUPABASE_URL` (اختیاری؛ مقدار پیش‌فرض هاردکدشده موجود است)
- رمز ادمین به‌صورت ثابت در `dataStore.ts` تا با `ADMIN_API_SECRET` مطابقت کند (هاردکد مجاز).

> دستور دیپلوی فانکشن (توسط مالک اجرا می‌شود):
> `supabase functions deploy admin-api --no-verify-jwt`

---

## ۶. جزئیات معماری سیستم کارت به کارت و مدیریت رسید (Card-to-Card Technical Architecture)

توسعه ساختار پایگاه داده و منطق Edge Function گیت‌وی جهش‌یافته جهت پیاده‌سازی هم‌زمان این فلوها:

### ۶.۱. توسعه و فیلدهای جدید در پایگاه داده (PostgreSQL Extend Schema)
برای پشتیبانی از فلوی آفلاین، علاوه بر جدول پرداخت‌های سنتی زیبال، فیلدها و کلاسترهای زیر به جداول اضافه یا بروز می‌شوند:

۱. **جدول `public.payments`**:
   - ستون `offline_receipt_url TEXT NULL`: نگه‌داری موقت آدرس رسید بارگذاری شده در Supabase Storage (سطل اختصاصی آفلاین).
   - ستون `manual_decline_reason TEXT NULL`: علت رد رسید توسط ناظر پلتفرم جهت بازخوانی کلاینت.
   - وضعیت جدید در فیلد `status`: مقدار `'pending_manual'` (فیش آفلاین ثبت شده و در انتظار رسیدگی ادمین) اضافه می‌شود. مقدار موفق همچنان `'paid'` است.

۲. **رویه رزرو و آزادسازی تخفیف (`discount_codes` Reservation Logic)**:
   - در لحظه کلیکِ ثبت پرداخت کارت به کارت توسط کاربر، یک فیش پرداخت در جدول با وایت‌استاتوس `'pending_manual'` ایجاد شده و در صورتی که کد تخفیفی همراه آن باشد، سهمیه استفاده شده کوپن در همان ثانیه ارتقا می‌یابد (`used_count = used_count + 1`).
   - در صورت رد فیش توسط ادمین در پنل، فرآیند رول‌بک اجرا شده و سهمیه کوپن متناظر کسر شده بازگردانی می‌گردد (`used_count = used_count - 1`).

### ۶.۲. جریان کاربری آپلود و ذخیره‌سازی شیء (Client Compress & Storage Stream)
```text
رسید تصویر (کاربر) ──► فشرده‌سازی کلاینت (Canvas API) < 500KB ──► آپلود در Storage سطل 'receipts' ──► ثبت تراکنش با 'pending_manual'
```

- برای مدیریت بهینه حجم در پلن رایگان سوپابیس، آپلود عکس بر روی سطل خصوصی `'receipts'` انجام شده و پس از تایید یا رد بلافاصله متد حذفیِ `storage.from('receipts').remove([filePath])` از داخل Edge Function با لایسنس `service_role` فراخوانی می‌گردد. وب‌اپ هیچ رسید نهایی یا موقتی را در Storage برای مدت طولانی انبار نخواهد کرد.

### ۶.۳. توسعه قرارداد اکشن‌های Gateway ادمین (`admin-api` Actions Extension)

درخواست‌های مدیریت کارت به کارت با فرستادن پلودهای زیر بررسی می‌شوند:

| action | فیلد ورودی بدنه | نتیجه و نحوه پاسخ دهی | وظیفه تراکنشی درگاه سرور |
|---|---|---|---|
| `list_manual_payments` | — | `Payment[]` | واکشی ردیف‌های پرداخت با وضعیت `'pending_manual'` به همراه آدرس فیش آفلاین و مشخصات کاربر. |
| `approve_manual_payment` | `{ payment_id, user_id }` | `{ ok: true }` | ۱. فراخوانی پروسجر `activate_subscription` دیتابیس (تغییر اشتراک به فعال و پرداخت به `'paid'`). ۲. حذف دائم رسید تصویر از Storage. |
| `reject_manual_payment` | `{ payment_id, user_id, reason }` | `{ ok: true }` | ۱. تغییر وضعیت پرداخت به `'failed'`. ۲. ثبت پاسخ در ستون `manual_decline_reason`. ۳. آزادسازی کوپن تخفیف رزروی (در صورت وجود). ۴. حذف دائم رسید تصویر از Storage. |


---

## ۷. معماری ماژول مارکتینگ و اتریبیوشن (Marketing Analytics Architecture)

### ۷.۰. تصمیم معماری کلیدی (محل سکونت FDW و Viewها) — لنگرگاه
- دو دیتابیس مجزا: **«تحلیلی»** (events، campaigns) و **«اصلی/اپ»** (profiles، subscriptions، payments، plans).
- طبق گزارش، **پنل ادمین جداول تحلیلی را با FDW می‌خواند و با داده‌ی کاربر/خرید JOIN می‌زند**؛ و طبق محدودیت کارفرما **ارتباط دو دیتابیس فقط FDW است**. نتیجه‌ی منطقی: اکستنشن `postgres_fdw`، foreign tableها و **همه‌ی Materialized View‌های گزارش روی دیتابیس اصلی** مستقر می‌شوند (همان کانکشنی که `admin-api` از قبل دارد). داشبورد هیچ کانکشن دومی به دیتابیس تحلیلی باز نمی‌کند.
- **تطبیق با محدودیت دایرکتوری:** با وجود اینکه «بریجِ FDW + Viewها» روی دیتابیس اصلی اجرا می‌شوند، **فایل‌های SQL آن‌ها فیزیکاً زیر `landing_supabase/admin_db_bridge/` قرار می‌گیرند** تا پوشه‌ی `supabase/` کاملاً دست‌نخورده بماند و تمام SQL مرتبط با تحلیل در یک‌جا (`landing_supabase/`) متمرکز باشد. این یک انتخاب آگاهانه‌ی معمار است.
- **اصل data-gravity:** جمع‌سازی سنگین روی دیتابیسی که داده‌ی پرحجم (`events`) دارد منطقی‌تر بود، اما چون «خواندن از سمت پنل ادمین» و «فقط FDW» دو الزام صریح‌اند، Viewها روی اصلی می‌مانند و فقط ستون‌های لازم رویداد از طریق foreign table کشیده می‌شوند. برای جلوگیری از افت، خروجی به‌صورت Materialized + ایندکس‌گذاری‌شده نگه‌داری می‌شود.

### ۷.۱. اسکیمای دیتابیس تحلیلی (روی پروژه‌ی Supabase «تحلیلی»)
> فایل‌ها: `landing_supabase/analytics_db/sql/*`

**`public.events`** (پرحجم‌ترین جدول؛ هر بازدید/کلیک یک رکورد)
| فیلد | نوع | توضیح |
|---|---|---|
| `id` | `BIGINT GENERATED ALWAYS AS IDENTITY PK` | کلید سبک برای حجم بالا |
| `anonymous_id` | `UUID NOT NULL` | قلب اتریبیوشن؛ از کوکیِ سطح‌دامنه |
| `event_type` | `TEXT NOT NULL` | `page_view` \| `cta_click_start_free` \| `cta_click_login` |
| `utm_source` | `TEXT` | مثلاً youtube، instagram؛ NULL = مستقیم |
| `utm_medium` | `TEXT` | |
| `utm_campaign` | `TEXT` | کلید اتصال به `campaigns` |
| `utm_content` | `TEXT` | |
| `utm_term` | `TEXT` | |
| `landing_host` | `TEXT` | مثل `dev.hexerapp.ir` (تفکیک لندینگ) |
| `page_path` | `TEXT` | |
| `referrer` | `TEXT` | |
| `created_at` | `TIMESTAMPTZ DEFAULT now()` | |

ایندکس‌ها: `(anonymous_id)`، `(utm_campaign)`، `(created_at)`، `(event_type)`.

**`public.campaigns`** (دفترچه‌ی کمپین‌ها — مرجع گزارش ۶.۰)
| فیلد | نوع | توضیح |
|---|---|---|
| `utm_campaign` | `TEXT PRIMARY KEY` | کلید یکتا، اتصال به events |
| `channel` | `TEXT NOT NULL` | یوتوب/اینستاگرام/... (تحلیل دسته‌جمعی) |
| `source_name` | `TEXT` | نام دقیق منبع (تحلیل تک‌کمپینی) |
| `start_date` | `DATE` | |
| `end_date` | `DATE` | |
| `cost_irr` | `BIGINT DEFAULT 0` | هزینه به ریال (مبنای CAC/ROI) |
| `currency` | `TEXT DEFAULT 'IRR'` | |
| `notes` | `TEXT` | |
| `created_at` | `TIMESTAMPTZ DEFAULT now()` | |

**RLS دیتابیس تحلیلی:** روی هر دو جدول RLS فعال. روی `events` فقط `INSERT` برای نقش `anon` (لندینگ‌ها رویداد می‌فرستند)؛ **هیچ SELECT عمومی**. روی `campaigns` نه INSERT/SELECT عمومی — مدیریت کمپین فقط از سمت پنل (از طریق FDW با نقش بریج) انجام می‌شود.

### ۷.۲. لایه‌ی بریج FDW (روی پروژه‌ی Supabase «اصلی»)
> فایل: `landing_supabase/admin_db_bridge/sql/00_fdw_setup.sql` (idempotent)
- `CREATE EXTENSION IF NOT EXISTS postgres_fdw;`
- اعتبارنامه‌ی اتصال به دیتابیس تحلیلی در **Supabase Vault** (`vault.create_secret(...)`)؛ هرگز هاردکد نشود.
- `CREATE SERVER analytics_srv ...` + `CREATE USER MAPPING ...` با خواندن secret از Vault.
- ساخت اسکیمای اختصاصی `marketing` روی دیتابیس اصلی (جداسازی کامل از اشیای اپ).
- foreign tableها فقط برای ستون‌های لازم: `marketing.events_fdw`, `marketing.campaigns_fdw`.
- **گرنت:** دسترسی SELECT روی foreign tableها فقط به `service_role` (نه `anon`/`authenticated`).
- `campaigns_fdw` به‌صورت **قابل‌نوشتن** تعریف می‌شود تا اکشن `marketing_save_campaign` بتواند با همان FDW در دفترچه‌ی کمپین بنویسد.

### ۷.۳. شش گروه گزارش به‌صورت Materialized View (روی دیتابیس اصلی، اسکیمای `marketing`)
> فایل: `landing_supabase/admin_db_bridge/sql/01_report_views.sql`
- **کلید اتریبیوشن:** `profiles.anonymous_id` ⨝ `events_fdw.anonymous_id`. مدل **first-touch**: برای هر `anonymous_id` قدیمی‌ترین رویدادِ دارای UTM به‌عنوان منبع انتساب داده می‌شود.
- نگاشت گزارش‌ها (مطابق بخش ۶ گزارش مرجع):
  1. `mv_traffic_overview` (۶.۱): بازدیدکننده‌ی یکتا در بازه‌های امروز/۷روز/۳۰روز × منبع (هر UTM + «مستقیم») × `landing_host`؛ به‌علاوه شمار کلیک «ورود» در برابر «شروع رایگان».
  2. `mv_funnel_by_channel` (۶.۲): شمارش و درصدِ visit → cta_click → register → free_start → purchase به تفکیک کانال.
  3. `mv_purchase_timing` (۶.۳): توزیع زمان خرید (لحظه‌ی ثبت‌نام / حین دوره‌ی رایگان / بعد از رایگان / اصلاً نخرید) به تفکیک کانال.
  4. `mv_retention_by_channel` (۶.۴): ماندگاری کوهورتی ماه ۱/۲/۳/۶ به تفکیک کانال (از وضعیت/تمدید `subscriptions`+`payments`).
  5. `mv_channel_roi` (۶.۵): کانال | بازدید | ثبت‌نام | خرید | نرخ تبدیل | هزینه‌ی کل | CAC | درآمد | ROI.
  6. `mv_campaign_detail` (۶.۶): همان متریک‌ها گروه‌بندی‌شده بر `utm_campaign` (تحلیل عمیق تک‌کمپینی + مقایسه با میانگین کانال).
- درآمد از `payments.amount_irr` با `status='paid'`؛ خرید/ثبت‌نام از `profiles`/`subscriptions`. روی هر MV `UNIQUE INDEX` برای امکان `REFRESH ... CONCURRENTLY`.

### ۷.۴. جدول خلاصه و زمان‌بندی رفرش
> فایل: `landing_supabase/admin_db_bridge/sql/02_summary_refresh.sql`
- تابع `marketing.refresh_all()` که همه‌ی MVها را `REFRESH MATERIALIZED VIEW CONCURRENTLY` می‌کند.
- زمان‌بندی با `pg_cron` (مثلاً هر ۳۰ دقیقه): `cron.schedule('mkt_refresh','*/30 * * * *', $$ SELECT marketing.refresh_all(); $$);`
- داشبورد همیشه از MVها می‌خواند (نه JOIN زنده)، پس FDW فقط در لحظه‌ی رفرش بار می‌گیرد.

### ۷.۵. قرارداد اکشن‌های جدید `admin-api` (مارکتینگ)
> همان Gateway تک‌فانکشنه؛ روتینگ بر اساس `action`. همه با `service_role` روی دیتابیس اصلی، فقط SELECT از اسکیمای `marketing` (و یک UPSERT روی `campaigns_fdw`).

| action | ورودی | خروجی (DTO) | عملیات سرور |
|---|---|---|---|
| `marketing_traffic` | `{ range? }` | `TrafficOverview` | select از `mv_traffic_overview` |
| `marketing_funnel` | `{ channel? }` | `FunnelStage[]` | select از `mv_funnel_by_channel` |
| `marketing_purchase_timing` | `{ channel? }` | `PurchaseTimingRow[]` | select از `mv_purchase_timing` |
| `marketing_retention` | — | `RetentionRow[]` | select از `mv_retention_by_channel` |
| `marketing_roi` | — | `ChannelRoiRow[]` | select از `mv_channel_roi` |
| `marketing_campaigns` | — | `CampaignSummary[]` | select از `campaigns_fdw` + خلاصه |
| `marketing_campaign_detail` | `{ utm_campaign }` | `CampaignDetail` | select از `mv_campaign_detail` فیلترشده |
| `marketing_save_campaign` | `{ utm_campaign, channel, source_name, start_date, end_date, cost_irr, notes }` | `{ ok }` | UPSERT روی `campaigns_fdw` (نوشتن از طریق FDW) |

### ۷.۶. قوانین درخت فایل (منطق مسیردهی این ماژول)
**فایل‌هایی که ساخته می‌شوند:**
- `landing_supabase/analytics_db/sql/00_extensions.sql` (pgcrypto)
- `landing_supabase/analytics_db/sql/01_events.sql`
- `landing_supabase/analytics_db/sql/02_campaigns.sql`
- `landing_supabase/analytics_db/sql/03_rls.sql`
- `landing_supabase/admin_db_bridge/sql/00_fdw_setup.sql`
- `landing_supabase/admin_db_bridge/sql/01_report_views.sql`
- `landing_supabase/admin_db_bridge/sql/02_summary_refresh.sql`
- `landing_supabase/README.md` (نقشه‌ی اجرا: کدام فایل روی کدام پروژه اجرا شود)
- `src/pages/MarketingDashboard.tsx`
- `src/components/charts/FunnelChart.tsx`
- `src/components/charts/RetentionMatrix.tsx`
- `src/components/marketing/ChannelRoiTable.tsx`
- `src/components/marketing/CampaignEditorModal.tsx`

**فایل‌هایی که ویرایش می‌شوند (در همین ریپو):**
- `supabase/functions/admin-api/index.ts` (افزودن caseهای `marketing_*` — هیچ کلاینت دومی؛ فقط select از اسکیمای `marketing`)
- `src/lib/supabase.ts` (افزودن DTOهای مارکتینگ — Anti-Corruption Layer)
- `src/lib/dataStore.ts` (افزودن متدهای `getMarketing*` / `saveMarketingCampaign`)
- `src/store/adminStore.ts` (افزودن `'marketing'` به `ActiveTab`)
- `src/components/layout/AdminLayout.tsx` (افزودن آیتم منو «مارکتینگ»)
- `src/App.tsx` (رندر `MarketingDashboard` وقتی `activeTab === 'marketing'`)

> یادداشت: پوشه‌های تکراریِ روتِ `components/` و `pages/` نسخه‌های قدیمی/AI-Studio‌اند؛ سورس معتبر فقط `src/` است (طبق `index.html → /src/main.tsx`). هیچ فایل جدیدی در روت ساخته نشود.

### ۷.۷. متغیرها / Secrets این ماژول
**روی Supabase اصلی (Vault، برای FDW):**
- `analytics_db_host`, `analytics_db_port`, `analytics_db_name`, `analytics_db_user`, `analytics_db_password` (اعتبارنامه‌ی اتصال FDW به دیتابیس تحلیلی).

**روی Edge Function `admin-api`:** متغیر جدیدی لازم نیست؛ همان `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `ADMIN_API_SECRET` کفایت می‌کند (گزارش‌ها از همان دیتابیس اصلی خوانده می‌شوند).

**سمت لندینگ‌ها (خارج از این ریپو):** `ANALYTICS_SUPABASE_URL` و `ANALYTICS_ANON_KEY` برای ارسال رویداد (در تسک‌های پروژه‌های خارجی).
