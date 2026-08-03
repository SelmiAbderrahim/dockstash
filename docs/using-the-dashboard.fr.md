# Utiliser le tableau de bord

Dockstash propose quatre écrans et un assistant de configuration unique. Chaque écran a une action principale.

## Assistant de configuration
1. **VPS de stockage** — collez hôte, utilisateur, port et clé SSH privée.
2. **Mot de passe de chiffrement** — affiché une seule fois. Copiez-le immédiatement dans un gestionnaire de mots de passe.
3. **Confirmation** — cochez « Je l'ai sauvegardé — le perdre = dépôts irrécupérables » pour activer **Terminé**.

## Projets
Chaque dossier sous `/var/www` devient une carte. Action principale : **Sauvegarder maintenant**, avec sortie restic en direct.

## Détail du projet
Trois onglets persistés dans `?tab=` :
- **Plan** — activer/désactiver fichiers, bases, Traefik.
- **Planning** — quotidien / hebdo / cron personnalisé, validé en ligne.
- **Test de restauration** — statut du dernier drill (Vérifié / Échec).

## Instantanés
Sélectionnez un projet, choisissez un point de restauration, cliquez **Restaurer**. Un dialogue exige de taper le nom exact du projet. Mode par défaut : restaurer vers un nouvel emplacement ; l'écrasement doit être choisi explicitement.

## Paramètres
Trois onglets dans `?tab=` : Stockage, Rétention, Mot de passe de chiffrement (rotation avec case escrow).
