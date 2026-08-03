# Languages & regional settings

Dockstash ships with seven interface languages. The one you see is chosen automatically the first time you visit, and you can change it at any time.

## Supported languages

- English (`en`) — default
- العربية (`ar`) — right-to-left layout
- Français (`fr`)
- Deutsch (`de`)
- Español (`es`)
- Русский (`ru`)
- 中文 (`zh`)

## How auto-detection works

- **In the browser** we read `navigator.language`. If it matches one of our seven locales (including region variants like `fr-CA` → French, `zh-TW` → Chinese), we use it. Otherwise we fall back to English.
- **On the server** we read your request's `Accept-Language` header (with quality values) so backend error messages, transactional emails, and API responses are localized. An explicit `x-lang` header or a `lang` cookie takes priority over `Accept-Language`.

## Switching language

Use the **Language** switcher in the top navigation. Your choice is remembered in a `lang` cookie for one year and takes effect immediately across the UI, error messages, and emails you receive.

## Right-to-left (RTL)

When you select **العربية**, we set `<html lang="ar" dir="rtl">` and the entire layout mirrors. Selecting any other language returns the layout to LTR.

## For developers

- The server-side default locale is controlled by the optional `DEFAULT_LOCALE` env var (see `.env.example`).
- The full namespace/key convention is documented in `client/src/shared/i18n/README.md` and `server/src/shared/i18n/README.md`.
