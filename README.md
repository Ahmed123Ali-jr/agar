# 📦 أغراضي

تطبيق ويب لإدارة وتتبع الأغراض في البيت — يحلّ مشكلة "وين حطيت الشي؟"

> سجّل أماكن التخزين، أضف الأغراض داخلها، وابحث بالصوت أو الكتابة عند الحاجة.

---

## ✨ المزايا

- 🔍 **بحث صوتي ونصي** — اسأل "وين شاحن الآيفون؟" يطلعلك المكان فوراً
- 👨‍👩‍👧‍👦 **مشاركة عائلية** — كود دعوة 6 أحرف، حتى 10 أعضاء
- 📦 **أماكن وأغراض** — إيموجي، صور اختيارية، ملاحظات
- 🔄 **مزامنة فورية** — عبر Supabase Realtime
- 📱 **PWA** — يتثبّت على الموبايل ويشتغل أوفلاين
- 🇸🇦 **عربي بالكامل** مع دعم RTL

---

## 🛠️ Stack

- **Frontend:** HTML + CSS + Vanilla JavaScript
- **Backend:** Supabase (Auth + Database + Storage + Realtime)
- **Voice:** Web Speech API
- **Hosting:** Vercel

---

## 🚀 الإعداد (5 خطوات)

### 1) إنشاء مشروع Supabase

1. اذهب إلى [supabase.com](https://supabase.com) وسجّل دخول
2. اضغط **New Project** — أعطه اسماً وكلمة سر للداتابيس
3. اختر منطقة قريبة (مثل Frankfurt أو Bahrain)
4. انتظر 1-2 دقيقة حتى يجهز

### 2) تشغيل SQL لإنشاء الجداول

1. في لوحة Supabase: **SQL Editor** → **New Query**
2. افتح ملف `supabase-setup.sql` من المشروع
3. الصق المحتوى كاملاً واضغط **Run**
4. تأكد من نجاح كل الأوامر (يفترض ترى Success)

> هذا يُنشئ: الجداول، RLS policies، RPC، Storage bucket باسم `agradi-images`.

### 3) جلب مفاتيح API

في Supabase: **Project Settings** → **API**

انسخ:
- **Project URL** (مثل `https://xxx.supabase.co`)
- **anon / public key** (مفتاح طويل يبدأ بـ `eyJ...`)

### 4) لصق المفاتيح في الكود

افتح `js/supabase.js` وعدّل:

```js
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIs...';
```

### 5) التشغيل المحلي

أبسط طريقة:

```bash
cd agradi
python3 -m http.server 5500
```

ثم افتح: <http://localhost:5500>

> أو استخدم Live Server في VS Code.

---

## ☁️ النشر على Vercel

### الطريقة 1: عبر GitHub

1. ارفع مجلد `agradi/` على GitHub
2. اذهب إلى [vercel.com](https://vercel.com) وسجّل دخول بحساب GitHub
3. **Add New** → **Project** → اختر الريبو
4. **Framework Preset:** Other
5. **Root Directory:** `agradi` (أو تركه فاضي إذا الريبو هو نفسه المجلد)
6. اضغط **Deploy** — جاهز في 30 ثانية ✓

### الطريقة 2: Vercel CLI

```bash
npm i -g vercel
cd agradi
vercel
```

اتبع الأسئلة (أول مرة فقط)، وبعدها:

```bash
vercel --prod
```

### بعد النشر

- **مهم:** في Supabase: **Authentication** → **URL Configuration** → أضف رابط Vercel إلى `Site URL` و `Redirect URLs`
- جرّب التطبيق على الجوال — اضغط "إضافة إلى الشاشة الرئيسية" لتثبيته PWA

---

## 🎤 ملاحظات البحث الصوتي

- يشتغل في **Chrome / Edge / Safari** (Web Speech API)
- يلزم **HTTPS** (Vercel يوفّره تلقائياً)
- على الجوال: يطلب إذن الميكروفون أول مرة

أمثلة استعلامات يفهمها:
- "وين شاحن الآيفون؟" → يبحث: "شاحن آيفون"
- "أين الجاكيت الأسود؟" → يبحث: "جاكيت أسود"
- "أبغى المفتاح" → يبحث: "المفتاح"

كلمات استفهام محذوفة تلقائياً: وين، أين، فين، حق، يا، أبي، ابغى.

---

## 🗂️ هيكل الملفات

```
agradi/
├── index.html              # الواجهة الكاملة
├── css/style.css           # التصميم (RTL، Mobile First)
├── js/
│   ├── supabase.js         # إعداد العميل + State + Helpers
│   ├── auth.js             # تسجيل دخول/جديد
│   ├── family.js           # العائلة وكود الدعوة
│   ├── locations.js        # الأماكن
│   ├── items.js            # الأغراض
│   ├── search.js           # بحث نصي + صوتي
│   ├── realtime.js         # المزامنة الفورية
│   └── app.js              # الراوتر والتهيئة
├── icons/
│   ├── icon.svg            # الأيقونة الأصلية
│   └── generate-icons.html # افتحها لتنزيل PNG 192/512
├── manifest.json           # PWA
├── service-worker.js       # PWA + offline cache
├── supabase-setup.sql      # SQL كامل (الصقه في Supabase)
├── vercel.json             # إعدادات النشر
└── README.md
```

---

## 🔐 RLS — كيف تشتغل الصلاحيات

- كل المستخدمين المسجلين ممكن ينشئون عائلة جديدة
- المستخدم يشوف فقط بيانات عائلته
- جميع أعضاء العائلة يقدرون يضيفون/يعدلون/يحذفون الأماكن والأغراض
- الانضمام بالكود يتم عبر RPC آمنة (`join_family_by_code`) — لا يمكن قراءة قائمة العائلات

---

## 🐛 مشاكل شائعة

**"يلزم إعداد Supabase" يظهر عند الفتح:**
لم تضع المفاتيح في `js/supabase.js`.

**"فشل رفع الصورة":**
تأكد من إنشاء bucket `agradi-images` كـ Public في Supabase Storage. ملف SQL يفعل ذلك تلقائياً، لكن لو تخطّاه، أنشئه يدوياً من Storage في لوحة Supabase.

**البحث الصوتي ما يشتغل:**
- شغّل التطبيق على HTTPS (Vercel) لا HTTP
- استخدم Chrome أو Safari
- اسمح بالميكروفون في إعدادات المتصفح

**ما يظهر شي بعد إنشاء العائلة:**
حدّث الصفحة. إذا استمر، تحقق من Console للأخطاء.

---

## 📝 الترخيص

استخدام شخصي/عائلي. حُرّر بالحب لأهل البيت. ❤️
