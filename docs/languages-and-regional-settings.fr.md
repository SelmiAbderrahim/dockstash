# Langues et paramètres régionaux

Dockstash propose sept langues d’interface. Celle qui s’affiche est choisie automatiquement à votre première visite, et vous pouvez en changer à tout moment.

## Langues prises en charge

- English (`en`) — par défaut
- العربية (`ar`) — mise en page de droite à gauche
- Français (`fr`)
- Deutsch (`de`)
- Español (`es`)
- Русский (`ru`)
- 中文 (`zh`)

## Détection automatique

- **Dans le navigateur**, nous lisons `navigator.language`. Si elle correspond à l’une des sept langues (y compris `fr-CA` → français), nous l’utilisons. Sinon, nous revenons à l’anglais.
- **Côté serveur**, nous analysons l’en-tête `Accept-Language` (avec les valeurs de qualité) pour que les messages d’erreur, les e-mails transactionnels et les réponses API soient localisés. Un en-tête `x-lang` ou un cookie `lang` explicite prend le pas.

## Changer de langue

Utilisez le sélecteur **Langue** dans la navigation. Votre choix est mémorisé dans un cookie `lang` pour un an.

## Droite à gauche (RTL)

Lorsque vous choisissez **العربية**, nous définissons `<html lang="ar" dir="rtl">` et toute la mise en page est inversée.

## Pour les développeurs

- La variable d’environnement optionnelle `DEFAULT_LOCALE` contrôle la langue par défaut du serveur.
- Consultez `client/src/shared/i18n/README.md` et `server/src/shared/i18n/README.md`.
