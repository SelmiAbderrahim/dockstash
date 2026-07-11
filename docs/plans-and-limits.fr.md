# Offres & limites

Dockstash propose trois offres. **Free** est l’offre par défaut open-source /
auto-hébergement et fonctionne sans fournisseur de paiement ; **Pro** et
**Business** sont conditionnées à un abonnement actif.

## La matrice

| Fonctionnalité       | Free       | Pro         | Business       |
|----------------------|------------|-------------|----------------|
| Projets              | 1          | 10          | Illimité       |
| Rétention            | 7 jours    | 30 jours    | 90 jours       |
| Fréquence planning   | Quotidien  | Horaire max | Toute cron     |
| Sauvegardes planifiées | —        | ✔           | ✔              |
| Alertes e-mail       | —          | ✔           | ✔              |
| Serveurs connectés   | 1          | 5           | Illimité       |

L’annuel = **10× le mensuel** (deux mois offerts). Les prix vivent dans les lignes
`PricingTier` et peuvent être modifiés sans redéploiement.

## Cycle de vie

- **Dunning / grâce.** Un paiement `past_due` ouvre une fenêtre de grâce de
  **14 jours** pendant laquelle les droits restent ceux de l’offre payante.
- **Expiration = lecture seule.** Les sauvegardes ne sont **jamais supprimées**.
  Les projets en trop passent en `paused`.
- **Downgrade au-dessus du quota.** Le compte passe en `selection-required` ;
  l’utilisateur choisit les projets qui restent actifs.
- **Remboursement.** L’abonnement est révoqué ; retour à Free.
- **Protection anti-abus des essais.** Un seul essai par e-mail.

## Merchant of Record

Polar est **Merchant of Record** : TVA, taxes et facturation sont gérées par
Polar. Aucun moteur de taxes n’est intégré.

## Offres par invitation

Un superadministrateur peut créer un lien d’invitation à usage unique
(**Superadmin → Invitations**) qui offre `pro` ou `business` pour **1 mois** ou
**1 an**. Le destinataire ouvre `/invite/<token>`, se connecte (ou s’inscrit) et
l’active.

- **Sémantique du préfixe.** Une activation écrit une ligne `Subscription` dont
  `providerSubscriptionId` vaut `invite-grant-<invitationId>`. Ce préfixe est le
  seul discriminant : le résolveur d’entitlements, le balayage nocturne, la
  supersession par webhook et l’exclusion de réconciliation s’y appuient. Les
  lignes Polar conservent leur sémantique fondée sur le statut.
- **Expiration.** L’offre cesse de donner droit dès que `currentPeriodEnd` est
  dépassé — appliqué à la lecture, pas par le balayage. Le job nocturne
  (`billing.invite-grant-expiry`, 03:30) passe ensuite la ligne à `canceled` et
  fait atterrir l’utilisateur sur `free` via `applyProjectCap` : les projets
  au-delà du plafond sont **mis en pause, jamais supprimés**.
- **Un achat prime sur une offre.** À l’activation d’un abonnement Polar, toute
  offre active de cet utilisateur est annulée. Un abonné payant actif ne peut pas
  activer un lien (`invitations.error.alreadySubscribed`) ; le lien reste en
  attente pour quelqu’un d’autre.
- **La réconciliation ignore les offres.** Elles n’ont pas d’équivalent Polar.
- **La révocation** est logique (`revokedAt`) et ne concerne qu’un lien non
  utilisé. Elle n’annule jamais une offre déjà activée.
