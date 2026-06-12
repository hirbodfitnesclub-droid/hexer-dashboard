# tasks.md — نقشه راه مرجع (Hexer Admin Panel)

> ترتیب اجرا اجباری و متوالی است. تسک‌هایی که روی فایل‌های یکسان می‌نویسند موازی نشده‌اند.
> هر تسک فقط کارهای محدوده‌ی خودش را انجام دهد. کدنویس: ساده، مدرن، بدون over-engineering.

---

## TASK 1 — افزودن ستون `is_active` به جدول کدهای تخفیف (Migration) [✅ انجام‌شده و تثبیت‌شده]

این تسک به‌طور کامل اجرا شده و در پایگاه داده تثبیت گشته است. نیازی به هیچ عملگر یا کدنویسی اضافی نیست.

---

## TASK 2 — ریفکتور Edge Function ادمین برای رفع مشکل OOM [بدهی فنی بحرانی]

**راهنمای پیاده‌سازی فنی:**
کد فعلی در اکشن‌های `list_subscriptions` و `list_payments` در فایل `supabase/functions/admin-api/index.ts` کل جدول‌های `profiles`، `plans` و `discount_codes` را با `.select('*')` در رم سرور بارگذاری می‌کند که باعث نشت حافظه (OOM) می‌شود. از آنجا که رابطه کلید خارجی مستقیمی بین این جداول و `profiles` وجود ندارد، PostgREST Joins کار نمی‌کند.

برنامه‌نویس **موظف است** این بخش‌ها را با تکنیک "واکشی هدفمند (Batch Querying)" بازنویسی کند:
1. ابتدا تراکنش‌ها/سابسکریپشن‌ها واکشی شوند.
2. با یک `Set`، شناسه‌های یکتای کاربران (`user_id`) استخراج شود.
3. با استفاده از فیلتر `.in('id', userIds)`، **فقط** دیتای پروفایل‌های مربوط به همان کاربران واکشی شود (برای `discount_codes` نیز همین کار انجام شود).
4. در نهایت در سرور مپ شده و به کلاینت ارسال شوند.
5. **مهم:** فیلدهای حیاتی مانند `id` و `created_at` پروفایل‌ها نباید در خروجی نهایی DTO جا بیفتند.

**محدودیت‌های اختصاصی تسک:**
- ✅ رفع OOM فقط با متد `.in()`.
- ❌ تلاش برای استفاده از PostgREST Joins (مثل `select('*, profiles(*)')`) اکیداً ممنوع است و باعث خطای پایگاه داده می‌شود.
- ❌ تغییر در اسکیما یا فایل‌های SQL ممنوع است.

CONTEXT_FILES: ["supabase/functions/admin-api/index.ts", "src/lib/supabase.ts"]

---

## TASK 3 — حذف وابستگی کلاینت به SDK سوپابیس و ریفکتور dataStore [بدهی فنی]

**راهنمای پیاده‌سازی فنی:**
متد `request` در `src/lib/dataStore.ts` در حال حاضر از `supabase.functions.invoke` استفاده می‌کند. از آنجا که ادمین با `x-admin-secret` کار می‌کند و سشن کاربری ندارد، این وابستگی اضافی است.

برنامه‌نویس **موظف است**:
1. متد `request` را با استفاده از متد بومی `fetch` جاوااسکریپت بازنویسی کند.
2. آدرس گیتوی: `${import.meta.env.VITE_SUPABASE_URL || '...'}/functions/v1/admin-api`
3. هدرها باید شامل `'Content-Type': 'application/json'` و `'x-admin-secret': ADMIN_SECRET` باشند.
4. **نکته حیاتی:** حتماً از `if (!response.ok)` برای هندل کردن خطاها استفاده شود تا در صورت بروز خطای سرور، پیام‌های Toast فارسی در کلاینت به درستی نمایش داده شوند.
5. فایل `src/lib/supabase.ts` پاکسازی شود و وابستگی کلاینت سوپابیس از آن حذف گردد (فقط تایپ‌ها و اینترفیس‌ها باقی بمانند).

**محدودیت‌های اختصاصی تسک:**
- ✅ حذف کاملِ `supabase.functions.invoke`.
- ✅ حفظ امضای توابع عمومی `dataStore` تا کامپوننت‌های فرانت نشکنند.

CONTEXT_FILES: ["src/lib/dataStore.ts", "src/lib/supabase.ts"]

---

## TASK 4 — هم‌سوسازی UI با داده‌ی اصلاح‌شده و رفع باگ‌های جزئی [✅ سالم و بدون نیاز به تغییر]

این تسک بررسی شده و کدهای مربوط به رندرهای چارت‌ها، مودال‌ها و توستر سالم ارزیابی شده‌اند (فرضیات غلط مربوط به باگ‌های آن توهم و اشتباه بوده است). این بخش بدون نیاز به کدنویسی به عنوان آماده و تایید شده تلقی می‌شود.

---

## TASK 5 — توسعه‌ی Gateway ادمین برای پرداخت‌های دستی (`admin-api`) [فیچر جدید - فاز کارت به کارت]

**راهنمای پیاده‌سازی فنی:**
به switch موجود در `supabase/functions/admin-api/index.ts` سه `case` جدید اضافه کن (هیچ caseی موجود تغییر نکند):
1. `list_manual_payments`:
   - select از `payments` با شرط `status = 'pending_manual'` (مرتب بر پایه `created_at`).
   - الصاق پروفایل کاربر به کمک PostgREST Join پیاده‌سازی شده در تسک ۲ (جلوگیری از OOM).
   - ساخت یک Signed URL کوتاه‌عمر برای دسترسی ادمین به تصویر رسید: `supabaseService.storage.from('receipts').createSignedUrl(path, 600)` و قرار دادن آدرس نهایی تحت کلید `receipt_signed_url` در خروجی.
2. `approve_manual_payment` (`{ payment_id }`):
   - واکشی آدرس فیش (`offline_receipt_url`) جهت برنامه‌ریزی حذف آن.
   - فراخوانی پروسیجر دیتابیسیِ `activate_manual_subscription` با شناسه پرداخت مربوطه.
   - پس از اعمال موفق، حذف دائم فایل از استوریج با دستور: `storage.from('receipts').remove([path])`
   - برگرداندن پاسخ موفق `{ ok: true }`.
3. `reject_manual_payment` (`{ payment_id, reason }`):
   - واکشی فیلد فیش `offline_receipt_url` از پایگاه داده.
   - فراخوانی پروسیجر دیتابیسیِ `reject_manual_payment` با متغیرهای لازم (رول‌بک کوپن تخفیف در سطح خود پروسیجر انجام می‌شود).
   - حذف دائم رسید تصویر از Storage جهت عدم انباشت حجم گاوصندوق ابری.
   - برگرداندن خروجی `{ ok: true }`.

**محدودیت‌های اختصاصی تسک:**
- ✅ ایجاد و اضافه کردن سه اکشن فوق به صورت کاملاً ایزوله بگونه‌ای که سایر اکشن‌ها مخدوش نشوند.
- ✅ پاکسازی کامل و بی‌قیدوشرط رسیدها از Storage سوپابیس در هر دو سناریوی رد یا تایید پرداخت.
- ❌ عدم بازگرداندن URLهای مستقیم و عمومی باکت خصوصی رسیدها (صرفاً استفاده از Signed URL موقت).

CONTEXT_FILES: ["supabase/functions/admin-api/index.ts", "src/lib/supabase.ts"]

---

## TASK 6 — فرانت پنل: صفحه‌ی تاییدات + مودال رد [فیچر جدید - فاز کارت به کارت]

**راهنمای پیاده‌سازی فنی:**
1. در `src/lib/supabase.ts`: فیلدهای `receipt_signed_url?: string` و `manual_decline_reason?: string | null` به همراه وضعیت جدید `'pending_manual'` به اینترفیس `Payment` اضافه شود.
2. در `src/lib/dataStore.ts`: هم‌سوسازی و توسعه متدهای `getManualPayments(): Promise<Payment[]>`, `approveManualPayment(id): Promise<boolean>` و `rejectManualPayment(id, reason): Promise<boolean>` با ارسال درخواست با بدنه مناسب از طریق متد fetch به گیت‌وی به همراه پیام‌های نوتیفیکیشن فارسی متناسب.
3. در `src/store/adminStore.ts`: تب‌بندی‌ها را بروزرسانی کرده و رشته `'manual_payments'` را به `activeTab` اضافه کنید.
4. در `src/components/layout/AdminLayout.tsx`: دکمه ناوبری «تاییدات کارت به کارت» را با استفاده از آیکون مناسب از مجموعه `lucide-react` در منوی ناوبری کنار گذارید.
5. در `src/App.tsx`: رندر کامپوننت ادمینی مدیریت درخواست‌های دستی یا همان `ManualPaymentsManager` برای تب جدید.
6. ایجاد صفحه `src/pages/ManualPaymentsManager.tsx` به صورت کاملاً راست‌چین و RTL به همراه جزئیات کاربران، آیکون‌ها، فیش تصویر و دو دکمه اصلی تایید/رد.
7. ساخت دو مودال کمکی در پوشه UI:
   - `src/components/ui/ReceiptViewerModal.tsx`: برای مشاهده فیش‌ها با سایز بزرگتر درون پورتال.
   - `src/components/ui/RejectReasonModal.tsx`: مودال حاوی فیلد متنی قابل ویرایش برای ادمین جهت درج دلایل رد فیش تراکنش.

**محدودیت‌های اختصاصی تسک:**
- ✅ پیاده‌سازی استایل‌ها و رنگ‌بندی‌های کاملاً منطبق با قالب Tailwind v4 بدون ساخت فایل‌های سی‌اس‌اس مجزا.
- ✅ برقراری کامل ارتباط با داده‌های فچ‌شده از `dataStore` بدون ارتباط‌های فرعی دور زدن لایه دسترسی اطلاعات.

CONTEXT_FILES: ["src/pages/Dashboard.tsx", "src/lib/dataStore.ts", "src/lib/supabase.ts", "src/store/adminStore.ts", "src/components/layout/AdminLayout.tsx", "src/App.tsx", "src/components/ui/ModalWrapper.tsx"]

---

# فاز مارکتینگ و اتریبیوشن (تسک‌های ۷ تا ۱۵)

> ترتیب اجباری است؛ هر تسک به خروجی تسک قبل وابسته است. تسک‌های SQL (۷–۱۰) و تسک‌های فرانت (۱۲–۱۵) روی فایل‌های مشترک می‌نویسند، پس **هرگز موازی اجرا نشوند**. برای کدنویس: هر تسک را کامل و بسته تحویل بده، خارج از محدوده‌ی تسک چیزی دست نزن.

## TASK 7 — اسکیمای دیتابیس تحلیلی: events + campaigns + RLS [فاز مارکتینگ]
**راهنمای پیاده‌سازی:**
1. ساخت فایل اسکیما در مسیر `landing_supabase/sql/01_analytics_schema.sql` که روی **پروژه‌ی Supabase تحلیلی جدید** اجرا می‌شود (نه دیتابیس اصلی).
2. راه‌اندازی ملزومات: `CREATE EXTENSION IF NOT EXISTS pgcrypto;`
3. جدول `public.events` دقیقاً با ستون‌های مشخص‌شده در بخش ۷.۱ سند معماری (کلید `BIGINT IDENTITY`, `anonymous_id UUID`, `event_type`, پنج فیلد UTM, `landing_host`, `page_path`, `referrer`, `created_at`) به همراه ۴ ایندکس بهینه روی آن.
4. جدول `public.campaigns` با `utm_campaign` به‌عنوان کلید اصلی (PK) و فیلدهای شناسه هزینه، تاریخ، کانال، و یادداشت‌ها.
5. فعال‌سازی RLS: روی جدول `events` فقط سیاست (Policy) از نوع `INSERT` برای نقش `anon` تعریف شود (بدون دسترسی عمومی برای SELECT). همچنین ابتدا نقش اختصاصی `mkt_bridge_user` با رمز عبور 'SecureBridgePassword123!' و خصیصه WITH LOGIN بدون دسترسی‌های سوپریوزر ایجاد شده و سیاست RLS جدول `campaigns` به گونه‌ای تعریف شود که فقط و فقط این نقش به صورت انحصاری دسترسی کامل (INSERT, UPDATE, SELECT) به آن داشته باشد. هیچ policy عمومی دیگری روی آن فعال نگردد.
**محدودیت‌های تسک:** تمامی کدها باید idempotent باشند. مسیر فایل خروجی دقیقاً `landing_supabase/sql/01_analytics_schema.sql` است. هیچ فایلی زیر پوشه `supabase/` در این تسک ساخته نشود. بدون داده‌ی seed صوری یا اضافی.
CONTEXT_FILES: ["docs/ARCHITECTURE.md", "supabase/sql/01_profiles.sql", "supabase/sql/12_rls.sql"]

## TASK 8 — بریج FDW + Vault + foreign tables روی دیتابیس اصلی [فاز مارکتینگ]
**راهنمای پیاده‌سازی:**
1. ساخت فایل مهاجرت در دیتابیس اصلی پلتفرم در مسیر `supabase/sql/36_marketing_fdw.sql` (به عنوان جزئی از صف مهاجرت‌های متوالی دیتابیس اصلی).
2. `CREATE EXTENSION IF NOT EXISTS postgres_fdw;` و `CREATE SCHEMA IF NOT EXISTS marketing;`
3. خواندن امن اطلاعات اتصال سرور تحلیلی از **Vault** دیتابیس اصلی و ساخت `CREATE SERVER analytics_srv` به همراه `CREATE USER MAPPING`. در زمان اتصال، حتماً کاربر جاری به نقش اختصاصیِ امن `mkt_bridge_user` در دیتابیس تحلیلی مپ شود و رمز عبور اتصال برای این نقش باید دقیقاً 'SecureBridgePassword123!' قرار داده شود. هرگونه اتصال مستقیم با نقش سوپریوزر یا `postgres` به دلیل نقض شدید امنیت ممنوع است.
4. تعریف و ایمپورت جداول خارجی با `CREATE FOREIGN TABLE` برای `marketing.events_fdw` و `marketing.campaigns_fdw` (با ستون‌های ضروری).
5. محدودسازی دسترسی کلاینت: اعمال `REVOKE ALL` برای anon و authenticated و اعطای دسترسی `GRANT SELECT` تنها به `service_role` روی جداول خارجی. جدول `campaigns_fdw` باید برای اعمال تغییرات از پنل ادمین قابل نوشتن بماند.
**محدودیت‌های بسیار مهم تسک:**
- مسیر فایل خروجی دقیقاً دیتابیس اصلی: `supabase/sql/36_marketing_fdw.sql` است.
- **تذکر فوق حیاتی:** برنامه‌نویس حق ندارد هیچگونه جدول یا نمای واقعی در اسکیمای `public` دیتابیس اصلی (مانند `profiles` یا `payments`) در این اسکریپت بسازد یا دستکاری کند. باید فرض کند این جداول از طریق فایل‌های دیتابیس 01 تا 35 از قبل روی دیتابیس اصلی مستقر شده‌اند.
- سکیوریتی مپینگ و فرایتینگ فقط روی اسکیمای مجزای `marketing` اعمال شود.
CONTEXT_FILES: ["docs/ARCHITECTURE.md", "landing_supabase/sql/01_analytics_schema.sql"]

## TASK 9 — شش Materialized View گزارش [فاز مارکتینگ]
**راهنمای پیاده‌سازی:**
1. ساخت فایل نمای گزارشات در مسیر انتهای صف مهاجرت‌های دیتابیس اصلی: `supabase/sql/37_marketing_views.sql` (در اسکیمای `marketing` دیتابیس اصلی).
2. پیاده‌سازی کلید انتساب First-Touch با تطبیق `profiles.anonymous_id = events_fdw.anonymous_id`.
3. تعریف هر ۶ نمای ماتریالیزه شده گزارش طبق جزییات بخش ۷.۳ معماری: `mv_traffic_overview`, `mv_funnel_by_channel`, `mv_purchase_timing`, `mv_retention_by_channel`, `mv_channel_roi`, `mv_campaign_detail`.
4. بسیار حیاتی: برای جلوگیری از شکستِ درازمدتِ `REFRESH MATERIALIZED VIEW CONCURRENTLY` به دلیل وجود مقادیر احتمالی `NULL` در فیلدهای UTM، حتماً ایندکس یکتای ترکیبی روی ویوی `mv_traffic_overview` را با عبارت `COALESCE` (به عنوان مثال `COALESCE(utm_source, 'direct')`, `COALESCE(utm_medium, 'direct')`, `COALESCE(utm_campaign, 'direct')`, `landing_host`) بسازید. برای مابقی ۵ ویو نیز ایندکس‌های یکتای ترکیبی دقیق بر اساس کلیدهایی که تضمین‌کننده یکتایی سطرها بدون مشکل null هستند (مانند کانال و مرحله در `channel` / `stage` یا `utm_campaign`) تعریف کنید.
5. محاسبات درآمد مبتنی بر مقادیر ستون `amount_irr` جدول پرداخت‌ها با شرط وضعیت `'paid'`؛ محاسبات هزینه بر اساس `cost_irr` جدول کمپین‌ها. روی هر MV یک `UNIQUE INDEX` بر اساس استراتژی بالا بساز (لازمه‌ی `REFRESH CONCURRENTLY` بدون خطا).
**محدودیت‌های بسیار مهم تسک:**
- مسیر فایل خروجی دقیقاً `supabase/sql/37_marketing_views.sql` است.
- **تذکر فوق حیاتی:** برنامه‌نویس حق ندارد هیچگونه جدول واقعی در اسکیمای `public` دیتابیس اصلی (مانند `profiles` یا `payments`) در این اسکریپت بسازد، بازنویسی کند یا دستکاری نماید. باید فرض کند این جداول از طریق فایل‌های دیتابیس 01 تا 35 قبلاً در دیتابیس اصلی ساخته شده‌اند و صرفاً از روی آن‌ها بخواند.
- منطق محاسبات مالی و CAC/ROI کلیداً داخل خود تحلیل لایه پایگاه داده (Materialized Views) متمرکز نگه داشته شود.
CONTEXT_FILES: ["docs/ARCHITECTURE.md", "supabase/sql/02_billing.sql", "supabase/sql/04_payments.sql", "supabase/sql/01_profiles.sql", "supabase/sql/36_marketing_fdw.sql"]

## TASK 10 — تابع رفرش + زمان‌بندی pg_cron [فاز مارکتینگ]
**راهنمای پیاده‌سازی:**
1. ساخت فایل کرون دیتابیس اصلی در آخرین فاز صف جدید مهاجرت‌ها در مسیر `supabase/sql/38_marketing_cron.sql` (روی دیتابیس اصلی پلتفرم).
2. ایجاد تابع `marketing.refresh_all()` برای ریفرش بهینه و همزمان تمام شش نمای ماتریالیزه شده با دستور `REFRESH MATERIALIZED VIEW CONCURRENTLY`.
3. فعال‌سازی اکستنشن کرون به همراه تعریف جابِ زمان‌بندی شونده (مثلاً هر ۳۰ دقیقه): `cron.schedule('mkt_refresh','*/30 * * * *', $$ SELECT marketing.refresh_all(); $$);` (تحت فاز غیرفعال‌سازی جاب‌های قبلی اول کار برای تامین حالت idempotency).
4. ایجاد مستند راهنمای `landing_supabase/README.md` جهت شفاف‌سازی و ترسیم دقیق چرخه راه‌اندازی و چگونگی ایمپورت و اجرای زنجیره فایل‌ها روی دیتابیس اصلی و تحلیلی.
**محدودیت‌های بسیار مهم تسک:**
- مسیر فایل خروجی دقیقاً `supabase/sql/38_marketing_cron.sql` است.
- **تذکر فوق حیاتی:** برنامه‌نویس حق ندارد هیچگونه جدول واقعی در اسکیمای `public` دیتابیس اصلی (مانند `profiles` یا `payments`) در این اسکریپت بسازد یا دستکاری کند. باید فرض کند این جداول از طریق فایل‌های دیتابیس 01 تا 35 قبلاً ساخته شده‌اند.
- عدم دخالت مستقیم در داخل طراحی مجدد ویوها؛ صرفاً فرآیند رفرش رول‌اوور شود.
CONTEXT_FILES: ["docs/ARCHITECTURE.md", "supabase/sql/37_marketing_views.sql"]

## TASK 11 — توسعه‌ی Gateway ادمین با اکشن‌های مارکتینگ [فاز مارکتینگ]
**راهنمای پیاده‌سازی:**
1. در `supabase/functions/admin-api/index.ts` هشت `case` جدول ۷.۵ را اضافه کن: `marketing_traffic`, `marketing_funnel`, `marketing_purchase_timing`, `marketing_retention`, `marketing_roi`, `marketing_campaigns`, `marketing_campaign_detail`, `marketing_save_campaign`.
2. همه با همان `supabaseService` موجود (service_role، دیتابیس اصلی) از اسکیمای `marketing` `select` می‌کنند (`.schema('marketing').from('mv_...')`). فقط `marketing_save_campaign` روی `campaigns_fdw` `upsert` می‌کند.
3. خروجی هر اکشن دقیقاً مطابق DTO تعریف‌شده در تسک ۱۲ شکل داده شود.
**محدودیت‌های تسک:** هیچ کلاینت Supabase دومی ساخته نشود. caseهای موجود (کاربر/اشتراک/پرداخت) لمس نشوند. الگوی پاسخ/CORS/خطا مثل caseهای فعلی.
CONTEXT_FILES: ["supabase/functions/admin-api/index.ts", "docs/ARCHITECTURE.md"]

## TASK 12 — لایه‌ی داده‌ی فرانت: DTOها + متدهای dataStore [فاز مارکتینگ]
**راهنمای پیاده‌سازی:**
1. در `src/lib/supabase.ts` اینترفیس‌های DTO مارکتینگ را اضافه کن: `TrafficOverview`, `FunnelStage`, `PurchaseTimingRow`, `RetentionRow`, `ChannelRoiRow`, `CampaignSummary`, `CampaignDetail`.
2. در `src/lib/dataStore.ts` متدها را اضافه کن: `getMarketingTraffic`, `getMarketingFunnel`, `getMarketingPurchaseTiming`, `getMarketingRetention`, `getMarketingRoi`, `getMarketingCampaigns`, `getMarketingCampaignDetail`, `saveMarketingCampaign` — همگی با همان `this.request(action, payload)` موجود و الگوی toast خطا.
**محدودیت‌های تسک:** فقط افزودن؛ متدها/تایپ‌های موجود تغییر نکنند. هیچ fetch مستقیم خارج از `request`.
CONTEXT_FILES: ["src/lib/supabase.ts", "src/lib/dataStore.ts"]

## TASK 13 — کامپوننت‌های چارت/جدول مارکتینگ [فاز مارکتینگ]
**راهنمای پیاده‌سازی:**
1. `src/components/charts/FunnelChart.tsx` (قیف تبدیل با Recharts؛ سبک تیره/`brand-*`، تولتیپ fa-IR مثل `RevenueChart`).
2. `src/components/charts/RetentionMatrix.tsx` (ماتریس/هیت‌مپ ماندگاری ماه ۱/۲/۳/۶).
3. `src/components/marketing/ChannelRoiTable.tsx` (جدول ROI کانال‌ها با فرمت `toLocaleString('fa-IR')`).
4. `src/components/marketing/CampaignEditorModal.tsx` (ویرایش هزینه/تاریخ/کانال؛ بر پایه‌ی `ModalWrapper` موجود).
**محدودیت‌های تسک:** فقط Recharts و کلاس‌های Tailwind/`glass-card` موجود؛ بدون CSS جدید. props داده را از بیرون بگیر (fetch نکن).
CONTEXT_FILES: ["src/components/charts/RevenueChart.tsx", "src/components/charts/PlanDistributionChart.tsx", "src/components/ui/Card.tsx", "src/components/ui/ModalWrapper.tsx", "src/lib/supabase.ts"]

## TASK 14 — صفحه‌ی داشبورد مارکتینگ [فاز مارکتینگ]
**راهنمای پیاده‌سازی:**
1. `src/pages/MarketingDashboard.tsx` با همان الگوی `Dashboard.tsx` (useState + useEffect + `Promise.all` روی متدهای `dataStore.getMarketing*`، `LoadingSpinner`، `StatsCard`).
2. شش بخش گزارش را بچین: کارت‌های ترافیک (۶.۱)، `FunnelChart` (۶.۲)، توزیع زمان خرید (۶.۳)، `RetentionMatrix` (۶.۴)، `ChannelRoiTable` (۶.۵)، و بخش تحلیل تک‌کمپینی (۶.۶) با انتخاب‌گر کمپین + دکمه‌ی ویرایش که `CampaignEditorModal` را باز می‌کند.
**محدودیت‌های تسک:** فقط از `dataStore` بخوان؛ محاسبات سنگین در ویوها انجام شده. layout ریسپانسیو با گرید Tailwind.
CONTEXT_FILES: ["src/pages/Dashboard.tsx", "src/lib/dataStore.ts", "src/lib/supabase.ts", "src/components/charts/FunnelChart.tsx", "src/components/charts/RetentionMatrix.tsx", "src/components/marketing/ChannelRoiTable.tsx", "src/components/marketing/CampaignEditorModal.tsx", "src/components/ui/StatsCard.tsx"]

## TASK 15 — اتصال ناوبری تب مارکتینگ [فاز مارکتینگ]
**راهنمای پیاده‌سازی:**
1. در `src/store/adminStore.ts` مقدار `'marketing'` را به نوع `ActiveTab` اضافه کن.
2. در `src/components/layout/AdminLayout.tsx` یک آیتم به آرایه‌ی `menuItems` اضافه کن: `{ id: 'marketing', label: 'تحلیل مارکتینگ', icon: TrendingUp }` (آیکن از lucide). همین آرایه هم دسکتاپ و هم موبایل را تغذیه می‌کند.
3. در `src/App.tsx` رندر شرطی `{activeTab === 'marketing' && <MarketingDashboard />}` و importش را اضافه کن.
**محدودیت‌های تسک:** بدون روتر؛ فقط `activeTab`. caseها/آیتم‌های موجود لمس نشوند.
CONTEXT_FILES: ["src/store/adminStore.ts", "src/components/layout/AdminLayout.tsx", "src/App.tsx", "src/pages/MarketingDashboard.tsx"]
