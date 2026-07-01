# Planifications & journaux en direct

Dockstash exécute les tâches sauvegarde / prune / check / drill selon des
planifications — via une file sérialisée qui garantit **une tâche par dépôt à
la fois**.

## Types de planification

| Type | Effet |
|---|---|
| `backup` | Diffuse les dumps DB et sauvegarde les chemins/configs. |
| `prune` | `restic forget --prune` selon la rétention. |
| `check` | `restic check` — intégrité du dépôt. |
| `drill` | Restaure le dernier snapshot et le compare. |

## Une tâche par dépôt

Deux planifications déclenchées ensemble sur le même dépôt sont sérialisées.
Les dépôts différents s'exécutent en parallèle. Prune est un type à part —
jamais en ligne avec un backup.

## Rétention → `forget`

```
keepDaily/keepWeekly/keepMonthly → --keep-daily/--keep-weekly/--keep-monthly
```

## Journaux en direct

Chaque tâche diffuse le stdout/stderr de restic via Socket.IO sur
`/scheduler`. Rejoignez la salle de la tâche avec votre JWT — accès limité au
propriétaire.

## Récupération

Après un crash, la reprise détecte un verrou orphelin et exécute
`restic unlock` avant de recommencer.
