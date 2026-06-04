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
