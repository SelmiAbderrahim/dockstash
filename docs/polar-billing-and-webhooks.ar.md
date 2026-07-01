# الفوترة عبر Polar والـ Webhooks

يشغّل Dockstash Polar كمزود دفع نشط خلف واجهة محايدة للمزود. يظل محول Stripe في
الشيفرة لكنه غير نشط افتراضيًا.

## نقاط النهاية

- `POST /api/billing/checkout` (يتطلب مصادقة) — بدء جلسة دفع مستضافة.
- `GET  /api/billing/portal` (يتطلب مصادقة) — فتح بوابة العميل المستضافة.
- `POST /api/billing/change-plan` (يتطلب مصادقة) — تبديل منتج الاشتراك النشط.
- `POST /api/billing/webhook` — استقبال إشعارات Polar. تحقق قبل التحليل.

## عنوان الـ Webhook

اضبط `https://<your-server>/api/billing/webhook` في لوحة تحكم Polar.

## توقيع Standard Webhooks

يتحقق Dockstash من كل إشعار وفق مخطط [Standard Webhooks](https://standardwebhooks.com):

- `signed_content = "{webhook-id}.{webhook-timestamp}.{rawBody}"`
- `signature      = base64(HMAC-SHA256(secret, signed_content))`
- الترويسة: `webhook-signature: v1,<sig> [v1,<sig> ...]`
- تُرفض الطوابع الزمنية خارج نافذة ±5 دقائق.

يعمل التحقق على البايتات الخام للطلب؛ لا يُحلل الجسم بـ `JSON.parse` إلا بعد
نجاح التحقق من التوقيع.

## القدرة على التكرار (Idempotency)

يُدرَج كل إشعار في مجموعة `webhook_event` بضمان فريد على `(provider, eventId)`.
تُختصر عمليات التسليم المكررة بردّ `200` مع الحالة المخزّنة — لا يُشغَّل أي
معالج مرتين. عند فشل المعالج، تنتقل الحالة إلى `failed` ويتزايد `retryCount`؛
يعيد Polar المحاولة مع تراجع تصاعدي.

## المصالحة (Reconciliation)

تعمل `reconcileSubscriptions()` كل 15 دقيقة. تستعلم عن الاشتراكات النشطة في
Polar وتصلح الانحراف في صفوف `Subscription` المحلية (الحالة،
`currentPeriodEnd`، `cancelAtPeriodEnd`). لا تنشئ صفوفًا لم يُبلغ عنها Polar،
ولا يوقف فشلُ سجل واحد الحلقة.

## متغيرات البيئة

| المتغير | الغرض |
|---|---|
| `PAYMENT_PROVIDER` | `none` / `polar` / `stripe`. الافتراضي `none`. |
| `POLAR_ACCESS_TOKEN` | سرّي على الخادم. مُشفَّر عند التخزين بـ `MASTER_ENCRYPTION_KEY`. |
| `POLAR_WEBHOOK_SECRET` | سرّ Standard Webhooks. يُقبل `whsec_…`. |
| `POLAR_SERVER` | `sandbox` (افتراضي) أو `production`. |
| `POLAR_PRO_PRODUCT_ID` | معرّف المنتج → خطة `pro`. |
| `POLAR_BUSINESS_PRODUCT_ID` | معرّف المنتج → خطة `business`. |
