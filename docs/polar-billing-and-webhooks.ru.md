# Биллинг Polar и webhooks

Dockstash использует Polar как активного платёжного провайдера за нейтральным
интерфейсом. Адаптер Stripe остаётся в коде, но по умолчанию неактивен.

## Эндпоинты

- `POST /api/billing/checkout` (auth) — запустить хостируемую сессию оплаты.
- `GET  /api/billing/portal` (auth) — открыть хостируемый портал клиента.
- `POST /api/billing/change-plan` (auth) — сменить продукт активной подписки.
- `POST /api/billing/webhook` — доставки Polar. Проверка до разбора.

## URL webhook

Настройте `https://<ваш-сервер>/api/billing/webhook` в панели Polar.

## Подпись Standard Webhooks

Dockstash проверяет каждую доставку по схеме [Standard Webhooks](https://standardwebhooks.com):

- `signed_content = "{webhook-id}.{webhook-timestamp}.{rawBody}"`
- `signature      = base64(HMAC-SHA256(secret, signed_content))`
- Заголовок: `webhook-signature: v1,<sig> [v1,<sig> ...]`
- Метки времени вне ±5 минут отклоняются.

Проверка выполняется по сырым байтам; тело никогда не парсится через
`JSON.parse` до успешной проверки подписи.

## Идемпотентность

Каждая доставка INSERT-ится в коллекцию `webhook_event` с уникальным
ограничением `(provider, eventId)`. Повторные доставки сразу возвращают `200`
с сохранённым статусом — обработчик не запускается дважды. При ошибке
обработчика строка переходит в `failed`, `retryCount` растёт; Polar
повторяет с backoff.

## Согласование (reconciliation)

`reconcileSubscriptions()` запускается каждые 15 минут. Опрашивает активные
подписки Polar и лечит расхождения в локальных строках `Subscription` (статус,
`currentPeriodEnd`, `cancelAtPeriodEnd`). Никогда не создаёт строки, которых
нет в Polar, и сбой одной записи не прерывает цикл.

## Переменные окружения

| Переменная | Назначение |
|---|---|
| `PAYMENT_PROVIDER` | `none` / `polar` / `stripe`. По умолчанию `none`. |
| `POLAR_ACCESS_TOKEN` | Только сервер. Шифруется в покое ключом `MASTER_ENCRYPTION_KEY`. |
| `POLAR_WEBHOOK_SECRET` | Секрет Standard Webhooks. Принимается `whsec_…`. |
| `POLAR_SERVER` | `sandbox` (по умолчанию) или `production`. |
| `POLAR_PRO_PRODUCT_ID` | id продукта → план `pro`. |
| `POLAR_BUSINESS_PRODUCT_ID` | id продукта → план `business`. |
