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
