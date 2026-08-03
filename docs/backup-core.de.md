# Backup-Kern

Dockstash behandelt jedes Projekt unter `/var/www/<name>` als Bündel aus vier
Backup-Schichten: Projektdateien, Datenbanken, Reverse-Proxy-Konfigurationen
und Compose-Metadaten. Diese Seite erklärt, was `scanProject` erkennt und wie
ein Lauf tatsächlich ausgeführt wird.

## Was `scanProject` erkennt

Für einen Projektpfad tut `scanProject` Folgendes:

1. Liest `<path>/docker-compose.yml`.
2. Geht jeden Dienst durch. Für jedes `image` beansprucht die
   Adapter-Registry (`postgres`, `mysql`, `mariadb`, `mongo`) das Image und
   erfasst eine Datenbank-Schicht mit aufgelöstem Containernamen und einem
   Dump-Befehl in reiner argv-Form.
3. Erkennt Reverse-Proxy-Konfigpfade — `/etc/traefik` bei Traefik-Images,
   `/etc/nginx` bei nginx.
4. Liefert einen `plan { paths, databases[], configs[] }`, den Sie im UI vor
   dem Speichern anpassen können.

## Die Regel „erst dumpen, dann restic“

Aktive Datenbankdateien werden **nie** von der Festplatte kopiert. Für jede
aktivierte Datenbank-Schicht startet Dockstash
`docker exec <container> <dumpCmd>` und streamt den Dump direkt in
`restic backup --stdin`. Konsistenz-Flags sind in jeden Adapter eingebaut:
`mysqldump --single-transaction`, `mongodump --oplog`, `pg_dumpall` gegen
den laufenden Server.

Jeder Befehl ist ein **argv-Array** — keine Shell-Interpolation, kein
`sh -c`. Ein Compose-Umgebungswert mit `$(rm -rf /)` wird zu einem literalen
Token, nicht zu einer Subshell.

## Die `/var/www/*`-Allowlist

Jeder Pfad — der Projektpfad, zusätzliche Pfade im Plan, per API übergebene
Werte — wird gegen die `/var/www/*`-Allowlist geprüft. Leere Strings,
`..`-Segmente, NUL-Bytes, Symlink-Abkürzungen und alles außerhalb von
`/var/www` werden verworfen, bevor restic oder dockerode sie sehen.

## Besitz

Projekte sind pro Benutzer isoliert. Jede Route unter `/api/backups`
verlangt ein JWT, und jede Projekt-Ressource wird über eine Besitzprüfung
geladen, die `403` liefert, wenn der Aufrufer nicht Eigentümer ist. Das
Restic-Repo-Passwort liegt im Projekt-Datensatz nur als
AES-256-GCM-Chiffretext vor; der Klartext wird ausschließlich im Prozess
zur Laufzeit entschlüsselt und niemals an den Client zurückgegeben.
