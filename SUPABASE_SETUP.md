# ربط Supabase — مورد رزق

1. أنشئ مشروع Supabase جديد خاص بـ "مورد رزق".
2. افتح SQL Editor.
3. الصق محتوى `supabase/schema.sql` واضغط Run.
4. من Project Settings > API خذ:
   - Project URL
   - Publishable key
5. ضعهم في `config.js`.
6. لا تضع Service Role Key في الموقع أو GitHub.

## أنواع الحسابات
- customer = حريف
- provider = مقدّم خدمة
- seller = بائع

## ملاحظة
النسخة الحالية تجهّز قاعدة البيانات بأمان، والواجهة الحالية تبقى قابلة للنشر حتى قبل إدخال مفاتيح Supabase.
