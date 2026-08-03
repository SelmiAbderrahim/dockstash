# Bootstrap-Wiederherstellung

Dieses Runbook deckt das Szenario „Produktions-VPS ist weg" ab. Es setzt
voraus, dass nur drei Dinge überlebt haben:

1. Der **Speicher-VPS** (mit Ihren restic-Repositories intakt).
2. Der **`MASTER_ENCRYPTION_KEY`** (außerhalb der Bandbreite gesichert).
3. Ihr gespeicherter **Konfigurations-Export-Umschlag**
   (`dockstash-export-*.json`).

Ohne diese drei sind die Repositories nicht wiederherstellbar — der Export-
Umschlag ist ohne den Master-Key inert, und der Master-Key ist ohne die
Speicher-Repos nutzlos.

## 1. Frischen Agenten aufsetzen

Stellen Sie einen sauberen Produktions-VPS bereit. Klonen Sie das Repo,
befüllen Sie `.env` und starten Sie den Stack:

```bash
docker compose up -d
```

Die Dienste `api`, `web`, `mongo`, `redis` und `docker-socket-proxy` starten
gegen eine leere Mongo. Es sind noch keine Projekte sichtbar.

## 2. Denselben `MASTER_ENCRYPTION_KEY` bereitstellen

Befüllen Sie `./secrets/master_encryption_key` mit dem byte-identischen
Schlüssel des alten Agenten. **Generieren Sie keinen** neuen — jeder
Chiffretext im Export-Umschlag ist an diesen Schlüssel gebunden.

## 3. Export-Umschlag importieren

Melden Sie sich als beliebiger Benutzer mit derselben Identität wie der alte
Eigentümer an, dann POST-en Sie den gespeicherten Umschlag an
`/api/recovery/import`:

```bash
curl -X POST http://localhost:8080/api/recovery/import \
  -H "Authorization: JWT $TOKEN" \
  -H "Content-Type: application/json" \
  -d @dockstash-export-2026-07-01.json
```

Der Import validiert die Umschlag-Form (`.strict()` zod), lehnt jedes Feld
ab, das wie ein Klartext-Geheimnis aussieht, und entschlüsselt jeden
Chiffretext mit Ihrem Master-Key. Ein manipulierter Umschlag oder ein
Umschlag, dessen `keyVersion` dieser Agent nicht entschlüsseln kann, wird
mit `HTTP 400` abgelehnt.

## 4. Speicher-Erreichbarkeit bestätigen

Nach dem Import läuft `restic snapshots` gegen das Repo jedes Projekts mit
dem entschlüsselten Passwort. Eine grüne Antwort bestätigt:

- Der Speicher-VPS ist erreichbar.
- Das Passwort entschlüsselt unter dem aktuellen `MASTER_ENCRYPTION_KEY`.
- Das Repository ist nicht beschädigt.

## 5. Wiederherstellen

Lösen Sie eine Wiederherstellungsübung aus dem Dashboard oder über den
Planer aus. Snapshots werden in einen Scratch-Workspace wiederhergestellt
und byte-/zeilenweise gegen erwartete Metadaten verglichen.

## Die Drei-Dinge-Invariante

**Der Verlust des Master-Keys oder der Wiederherstellungscodes macht den
Export-Umschlag inert.** Der Umschlag enthält nur AES-256-GCM-Chiffretext.
Er ist sicher außerhalb des Servers zu speichern — eine Kopie in falschen
Händen ist ohne den Schlüssel nutzlos.

Speichern Sie `MASTER_ENCRYPTION_KEY` und die Wiederherstellungscodes auf
getrennten Medien, an getrennten physischen Orten und niemals im selben
Backup wie der Umschlag.
