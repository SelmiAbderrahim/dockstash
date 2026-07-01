# Facturation Polar & webhooks

Dockstash utilise Polar comme fournisseur de paiement actif derrière une
interface neutre. L'adaptateur Stripe reste dans le code mais est inactif par
défaut.

## Points d'entrée

- `POST /api/billing/checkout` (authentifié) — démarrer un paiement hébergé.
- `GET  /api/billing/portal` (authentifié) — ouvrir le portail client hébergé.
- `POST /api/billing/change-plan` (authentifié) — changer le produit de l'abonnement.
- `POST /api/billing/webhook` — livraisons Polar. Vérification avant analyse.

## URL du webhook

Configurez `https://<votre-serveur>/api/billing/webhook` dans le tableau de bord
Polar.

## Signature Standard Webhooks

Dockstash vérifie chaque livraison via le schéma [Standard Webhooks](https://standardwebhooks.com) :

- `signed_content = "{webhook-id}.{webhook-timestamp}.{rawBody}"`
- `signature      = base64(HMAC-SHA256(secret, signed_content))`
- En-tête : `webhook-signature: v1,<sig> [v1,<sig> ...]`
- Les horodatages hors ±5 minutes sont rejetés.

La vérification s'exécute sur les octets bruts ; le corps n'est jamais
`JSON.parse` avant validation de la signature.

## Idempotence

Chaque livraison est INSÉRÉE dans la collection `webhook_event` sous la
contrainte d'unicité `(provider, eventId)`. Une livraison en double se termine
directement par un `200` avec le statut mémorisé — aucun handler n'est appelé
deux fois. En cas d'échec, la ligne passe à `failed` et `retryCount`
s'incrémente ; Polar retente avec un backoff.

## Réconciliation

`reconcileSubscriptions()` s'exécute toutes les 15 minutes. Elle interroge les
abonnements actifs de Polar et corrige la dérive des lignes `Subscription`
locales (statut, `currentPeriodEnd`, `cancelAtPeriodEnd`). Elle ne crée jamais
de lignes que Polar ne rapporte pas, et un enregistrement en échec n'arrête pas
la boucle.

## Environnement

| Variable | Rôle |
|---|---|
| `PAYMENT_PROVIDER` | `none` / `polar` / `stripe`. Défaut `none`. |
| `POLAR_ACCESS_TOKEN` | Serveur uniquement. Chiffré au repos avec `MASTER_ENCRYPTION_KEY`. |
| `POLAR_WEBHOOK_SECRET` | Secret Standard Webhooks. `whsec_…` accepté. |
| `POLAR_SERVER` | `sandbox` (défaut) ou `production`. |
| `POLAR_PRO_PRODUCT_ID` | Identifiant produit → plan `pro`. |
| `POLAR_BUSINESS_PRODUCT_ID` | Identifiant produit → plan `business`. |
