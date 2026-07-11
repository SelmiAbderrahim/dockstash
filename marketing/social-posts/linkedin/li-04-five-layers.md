# LI-04 — Five Backups, Not One (educational post)

**Angle:** educational, carousel-ready · **Length:** list post
**CTA:** soft. Each numbered item can become one carousel slide.

---

A Docker project is five backups, not one.

Miss any layer and restore day gets interesting — in the wrong way.

**1. Volumes and bind mounts.**
The obvious one. Note: bind mounts get missed constantly because they look like part of the host, not part of the project. Read your compose file and find the one you forgot. There's always one.

**2. Databases — dumped, not copied.**
Copying /var/lib/postgresql/data from a running container gives you torn pages that will never start. Ask the database instead: pg_dumpall, mysqldump --single-transaction, mongodump --oplog — from inside the running container.

**3. The .env and compose files.**
Everyone backs up the volume. Almost nobody backs up the .env. Restore the data, lose the file that says which database, which secret, which port — and you own a very well-preserved brick.

**4. Reverse-proxy config.**
Traefik labels, nginx confs, cert paths. Restore the app, lose the routing, spend a Saturday remembering how it was wired.

**5. The proof it restores.**
A scheduled restore drill: latest snapshot into a throwaway container, verify, destroy. Without this layer, layers 1–4 are a hypothesis.

Miss layer 2 and the rest is decoration. Miss layer 5 and you find out about layer 2 during an outage.

(I build Dockstash — it detects all five from your compose file and backs them up in one plan. But the checklist is tool-agnostic; audit your setup against it either way.)

Which layer is your setup missing? Honest answers only — mine was #3 for an embarrassingly long time.

---

**Ops notes**
- Carousel version: title slide + one slide per layer + CTA slide. Monochrome,
  design-system tokens, real product screenshots where relevant.
- The closing self-deprecation line needs to be true for you — adjust which layer.
- Used on: ____
