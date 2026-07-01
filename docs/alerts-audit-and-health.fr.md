# Alertes, audit et santé

Dockstash fait du bruit en cas d'échec. Toute sauvegarde, restauration ou test
échoué déclenche immédiatement un e-mail (via Resend) au propriétaire du projet.
Un heartbeat de type dead-man's-switch capte les arrêts silencieux — quand rien
n'a échoué mais rien ne s'est exécuté non plus.

## Ce qui déclenche une alerte

| Type | Quand |
|---|---|
| `backup` | Une sauvegarde échoue à n'importe quelle couche. |
| `restore` | Une restauration échoue. |
| `drill` | Un test de restauration planifié échoue. |
| `heartbeat` | Aucune sauvegarde réussie depuis `ALERT_HEARTBEAT_HOURS` heures. |

Chaque e-mail porte le nom du projet, l'erreur, l'horodatage de la dernière
sauvegarde réussie et un lien vers le tableau de bord. Si `ALERT_WEBHOOK_URL`
est défini, la même charge utile JSON est POST à cette URL.

## Fenêtre du heartbeat

`ALERT_HEARTBEAT_HOURS` (défaut `24`) définit le seuil de l'arrêt silencieux.
Si la dernière sauvegarde réussie est plus ancienne que ce délai, le sweep
alerte une seule fois et déduplique pour la même fenêtre.

## Journal d'audit

Les actions destructrices ou facturables sont ajoutées à un journal
immuable : `backup.run`, `backup.restore`, `backup.delete`, `plan.change`.
Chaque entrée capture acteur, action, cible, IP source et horodatage.

Récupérez votre journal via `GET /api/audit` (portée propriétaire, auth requise).

## Endpoints santé et métriques

- `GET /api/health` — probe de disponibilité (200/503).
- `GET /api/metrics` — compteurs agrégés.
- `GET /api/health/projects` — par projet, portée propriétaire.

## Variables d'environnement

| Variable | Objet |
|---|---|
| `RESEND_API_KEY` | Clé Resend. |
| `RESEND_FROM` | Adresse expéditeur. |
| `ALERT_HEARTBEAT_HOURS` | Seuil d'arrêt silencieux. |
| `ALERT_WEBHOOK_URL` | URL webhook facultative. |
