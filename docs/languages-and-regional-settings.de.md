# Sprachen & regionale Einstellungen

Dockstash unterstützt sieben Oberflächensprachen. Die Sprache wird beim ersten Besuch automatisch gewählt und kann jederzeit geändert werden.

## Unterstützte Sprachen

- English (`en`) — Standard
- العربية (`ar`) — Layout von rechts nach links
- Français (`fr`)
- Deutsch (`de`)
- Español (`es`)
- Русский (`ru`)
- 中文 (`zh`)

## Wie die automatische Erkennung funktioniert

- **Im Browser** lesen wir `navigator.language`. Passt sie zu einer der sieben Sprachen (auch Varianten wie `de-AT` → Deutsch), verwenden wir sie. Sonst Fallback auf Englisch.
- **Auf dem Server** verarbeiten wir den `Accept-Language`-Header (mit Quality-Werten), damit Fehlermeldungen, transaktionale E-Mails und API-Antworten lokalisiert sind. Ein explizites `x-lang`-Header oder ein `lang`-Cookie hat Vorrang.

## Sprache wechseln

Nutzen Sie den **Sprache**-Umschalter in der Navigation. Ihre Wahl wird ein Jahr im `lang`-Cookie gespeichert.

## Rechts-nach-links (RTL)

Wenn Sie **العربية** wählen, setzen wir `<html lang="ar" dir="rtl">`, und das gesamte Layout wird gespiegelt.

## Für Entwickler

- Die optionale Umgebungsvariable `DEFAULT_LOCALE` steuert die Standardsprache des Servers.
- Siehe `client/src/shared/i18n/README.md` und `server/src/shared/i18n/README.md`.
