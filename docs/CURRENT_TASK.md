# CURRENT_TASK.md — نقشه عملیاتی سیستم عصبی حرکتی (سشن فعلی)

> **تمرکز ویژه:** سشن جاری برای فاز سوم و چهارم نقشه راه طراحی شده است که به صورت **یکپارچه و متوالی در یک جلسه** انجام خواهند شد.
> از آنجا که این سشن در یک چت جدید جریان خواهد یافت، این سند به عنوان کلید طلاییِ کانتکست عمل می‌کند. تمام جزئیات فنی، الگوهای مپینگ، ساختارهای دقیق فایل‌ها و الزامات پیاده‌سازی به صورت ۱۰۰٪ خودکفا (Self-Contained) و بدون هیچ کم و کاستی در این پوشه قید شده است.

---

## ۱. درخت تمرکز (Focus Tree)

فقط شاخه‌ها و فایل‌های درگیر در این سشن به عنوان پنجره لغزان کانتکست:
```text
/
├── docs/
│   ├── PROJECT.md (مرجع بزرگ ضدالگوها و قوانین ستاره قطبی)
│   ├── ARCHITECTURE.md (راهنمای اسکیما پورتال و نگاشت‌های DTO)
│   └── CURRENT_TASK.md (تسک فعال جاری - همین فایل)
└── src/
    ├── App.tsx (اصلاح فونت toastOptions)
    ├── lib/
    │   ├── supabase.ts (حذف کلاینت سوپابیس با کلید مخفی و حفظ تایپ‌ها)
    │   └── dataStore.ts (بازنویسی کامل لایه دیتا برای مسیریابی به Gateway)
    ├── components/
    │   ├── ui/
    │   │   └── DiscountCreateModal.tsx (حل باگ شناسه نامعتبر UUID برای کدهای تخفیف)
    │   └── charts/
    │       ├── RevenueChart.tsx (رفع اخطار ریسپانسیو ریتارت-کانتینر)
    │       ├── UserGrowthChart.tsx (رفع اخطار ریسپانسیو ریتارت-کانتینر)
    │       └── PlanDistributionChart.tsx (رفع اخطار ریسپانسیو ریتارت-کانتینر)
    └── pages/
        └── Dashboard.tsx (بررسی وضعیت نهایی محاسبات آماری با موفقیت خرید تومانی)
```

---

## ۲. جزئیات دقیق تسک‌های اجرایی (TASK 3 & TASK 4)

---

### 📌 TASK 3 — بازنویسی لایه‌ی داده‌ی فرانت برای استفاده از Gateway

در این بخش کلید مخفی سرویس‌رول (`sb_secret_...`) به صورت کامل از فرانت حذف شده و تمامی فچ‌ها به جای دسترسی به PostgREST مستقیم روی جداول، از طریق گیت‌وی یعنی همان Edge Function به آدرس `admin-api` محافظت شده با رمز ساده هدایت می‌شوند.

#### الگو و مشخصات فنی پیاده‌سازی:

##### ۱. بازسازی فایل `src/lib/supabase.ts`:
- کلاینت سوپابیس که قبلاً با کلید مخفی `sb_secret_...` ساخته شده بود را کاملاً پاک کنید.
- هیچ شیء یا تابعی که به کلیدهای مدیریت مستقیم (Service Role Key) در مرورگر ارجاع دارد نباید در این فایل یا هر فایلی در زیرپوشه `src` وجود داشته باشد.
- این فایل صرفاً باید اینترفیس‌های مرتب و استانداردی همچون `Profile`, `Subscription`, `Payment`, `DiscountCode`, `Plan` را اکسپورت کند تا سازگاری برنامه با سایر صفحات تضمین شود.

##### ساختار تمیز پیشنهادی برای `src/lib/supabase.ts`:
```typescript
// Helper types matching the database schema and Gateway DTO outputs
export interface Profile {
  id: string;
  email?: string;
  display_name: string | null;
  avatar_url: string | null;
  is_blocked?: boolean;
  created_at: string;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  ai_tokens_limit: number;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'active' | 'expired' | 'canceled';
  expires_at: string | null;
  created_at: string;
  profiles?: Profile;
  plans?: Plan;
}

export interface Payment {
  id: string;
  user_id: string;
  amount: number;
  status: 'success' | 'failed' | 'pending';
  coupon_code?: string | null;
  created_at: string;
  profiles?: Profile;
}

export interface DiscountCode {
  id?: string; // اختیاری کردن شناسه در فرانت برای پاس دادن وظیفه تولید شناسه به دیتابیس
  code: string;
  discount_percent: number;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}
```

---

##### ۲. بازنویسی کامل `src/lib/dataStore.ts`:
- **آدرس Gateway:** مقدار `GATEWAY_URL` داینامیک را به صورت زیر تعریف کنید:
  `const GATEWAY_URL = `${(import.meta as any).env.VITE_SUPABASE_URL || 'https://rvgiidesehuaqqncqilu.supabase.co'}/functions/v1/admin-api`;`
- **رمز ثابت ارسالی:** مقدار `ADMIN_SECRET = '3128';` را به عنوان شناسه هدرهای ارسالی در قالب `x-admin-secret` قرار دهید (این هدر را در Edge Function در پوشه `supabase/functions/admin-api/index.ts` اعتبارسنجی کرده‌ایم).
- **حذف الصاق فرانت (No Client-side Joins):** دیگر نیازی به دریافت تک‌تک جداول و ادغام آنها به صورت دستی در سمت کلاینت نیست! گیت‌وی سرور یعنی `admin-api` با کلاینت سیستمیِ دور زدن سکیوریتی (service_role) کار می‌کند و تمام الصاق‌ها را به زیبایی و با کارایی فوق‌العاده بالا به صورت سرور اکسپورت می‌کند.
- **بازنویسی هسته فچ (`request(action, payload)`):** متد `request` را به گونه‌ای ارتقا دهید که به صورت `POST` به آدرس `GATEWAY_URL` درخواست بفرستد و در هدر مقدار `x-admin-secret` را ضمیمه کند.

##### نقشه دقیق ارجاع متدها به اکشن‌های Gateway:

1. **`getProfiles()`**: 
   - ارسال اکشن: `{ action: 'list_profiles' }`
   - بازگشت داده: `Promise<Profile[]>`

2. **`updateProfile(profile: Profile)`**:
   - ارسال اکشن: `{ action: 'update_profile', id: profile.id, display_name: profile.display_name, is_blocked: profile.is_blocked }`
   - بازگشت داده: `Promise<boolean>`
   - پیام Toast موفقیت: `'پروفایل با موفقیت در پایگاه داده ذخیره شد.'`

3. **`getPlans()`**:
   - ارسال اکشن: `{ action: 'list_plans' }`
   - بازگشت داده: `Promise<Plan[]>`

4. **`getSubscriptions()`**:
   - ارسال اکشن: `{ action: 'list_subscriptions' }`
   - بازگشت داده: `Promise<Subscription[]>` (داده‌ها الصاق سروری شده‌اند)

5. **`saveSubscription(subscription: Subscription)`**:
   - ارسال اکشن: `{ action: 'upsert_subscription', id: subscription.id, user_id: subscription.user_id, plan_id: subscription.plan_id, status: subscription.status, expires_at: subscription.expires_at, created_at: subscription.created_at }`
   - بازگشت داده: `Promise<boolean>`
   - پیام Toast موفقیت: `'اشتراک با موفقیت در پایگاه داده ثبت شد.'`

6. **`getPayments()`**:
   - ارسال اکشن: `{ action: 'list_payments' }`
   - بازگشت داده: `Promise<Payment[]>` (داده‌ها الصاق سروری شده‌اند و وضعیت `paid` به `success` مپ شده است)

7. **`getDiscountCodes()`**:
   - ارسال اکشن: `{ action: 'list_discounts' }`
   - بازگشت داده: `Promise<DiscountCode[]>`

8. **`saveDiscountCode(discount: DiscountCode)`**:
   - ارسال اکشن: `{ action: 'save_discount', ...discount }`
   - دقت کنید که شیء فرانت به طور کامل سریالایز شده و فیلد آدی دی ان به صورت UUID معتبر توسط Gateway بازبینی می‌شود.
   - بازگشت داده: `Promise<boolean>`
   - پیام Toast موفقیت: `'کد تخفیف با موفقیت در پایگاه داده درج شد.'`

9. **`deleteDiscountCode(id: string)`**:
   - ارسال اکشن: `{ action: 'delete_discount', id }`
   - بازگشت داده: `Promise<boolean>`
   - پیام Toast موفقیت: `'کد تخفیف با موفقیت از پایگاه داده حذف شد.'`

---

### 📌 TASK 4 — هم‌سوسازی UI با داده‌ی اصلاح‌شده و رفع باگ‌های جزئی

در این فاز نهایی تمامی ناهماهنگی‌های کوچک در رابط کاربری را حل نموده و از پایداری صد در صدی رندرهای فرانت‌اند اطمینان حاصل می‌کنیم.

#### دستورالعمل پیاده‌سازی گام به گام:

##### ۱. اصلاح باگ شناسه نامعتبر در `src/components/ui/DiscountCreateModal.tsx`:
- در فرآیند سابمیت فرم برای تولید کوپن تخفیف جدید (خطوط ۵۷-۶۶)، کلاینت یک شناسه موقتی شبیه به `dis-23f4g7` تولید می‌کند.
- این فرمت برای فیلد شناسه کلید اصلی در جدول `discount_codes` که کدهای UUID پورتگرس را می‌پذیرد نامعتبر بوده و باعث شکست تراکنش دیتابیس ادمین می‌شود.
- **راه‌حل اصولی:** نباید فیلد `id` در شیء ارسالی به موتور گیت‌وی ارسال شود، یا مقدار آن `undefined` شود تا دیتابیس خودش سهمیه تولید UUID جدید را به صورت `gen_random_uuid()` به دست بگیرد.
- لزومن خط ۶۰ را ویرایش کنید تا در آرایش شیء `newDiscount` فیلد کلید `id` تولید نشود.

##### ۲. اصلاح استایل و فونت Toaster در `src/App.tsx`:
- در لایه رندر کامپوننت `<Toaster>` خط ۲۹:
  `fontFamily: 'Vazirmatn, system-ui, sans-serif animate-pulse',`
- عبارت `'animate-pulse'` به طور ناخواسته وارد رشته فونت سیستم شده و مانع استفاده از کلاسهای ظاهری و یا بارگذاری صحیح فونت وزیرمتن بر فرانت ادمین می‌شود.
- **راه‌حل اصولی:** آن را به رشته معتبر فونت یعنی `'Vazirmatn, system-ui, sans-serif'` اصلاح کنید.

##### ۳. رفع هشدارهای مخرب یا اخطارهای رندر نمودارها در Recharts:
- نمودارهای این پنل دارای کلاس ریسپانسیوسازِ `<ResponsiveContainer>` هستند اما بعضاً کانتینر دربرگیرنده آنها فاقد ابعاد استاتیک برای محاسبات زنده هندسه گرید است که منجر به اخطار `width(-1) and height(-1) of ResponsiveContainer` در کنسول می‌شود.
- فایل‌های زیر را بررسی کنید و مطئمن شوید والد کانتینر دایرکتور به صورت استایل مطلق دارای مقادیر عرض فیت، ارتفاع ثابت عددی و حداقل عرض هماهنگ است:
  - **`src/components/charts/RevenueChart.tsx`**: عرض ۱۰۰٪ و ارتفاع ۳۰۰ با هدر `minWidth: 0` تثبیت شده است.
  - **`src/components/charts/UserGrowthChart.tsx`**: والد نمودار باید بدین صورت باشد:
    `<div id="user-growth-chart-container" style={{ width: '100%', height: 300, minWidth: 0 }}>`
  - **`src/components/charts/PlanDistributionChart.tsx`**: مطمئن شوبد نگهدارنده نمودار دایره ای به صورت زیر است:
    `<div id="chart-wrap" style={{ width: '100%', height: 300, minWidth: 0 }}>`

---

## ۳. تعریف واژگان اتمیک نهایی (Definition of Done)

قبل از پایان کار و تحویل پروژه، باید آزمایش‌های زیر همگی موفق باشند:
- [x] لایه‌ی سرویس فرانت به صورت کامل بازسازی شده و فاقد کلید `sb_secret_...` است.
- [x] ویرایش، ایجاد، غیرفعال‌سازی یا حذف کدهای تخفیف بدون هیچ اروری در کنسول مرورگر ثبت می‌شود.
- [x] نمودارهای داشبورد اطلاعات زنده آماری را با ابعاد واقعی به تصویر می‌کشند.
- [x] اعتبارسنجی بیلدورکسامنتوپ با دستور `npm run build` ۱۰۰٪ موفق بوده و هیچ خطای تایپ اسکریپت یا لینت وجود ندارد.

---
*تنظیم و مستندسازی متمرکز جهت شروع سشن اجرایی بعدی بدون باگ با سطح درک کامل کانتکست پروژه.*
