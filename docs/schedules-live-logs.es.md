# Programaciones y registros en vivo

Dockstash ejecuta trabajos de backup / prune / check / drill según
programaciones — mediante una cola serializada que garantiza **un trabajo por
repositorio a la vez**.

## Tipos de programación

| Tipo | Efecto |
|---|---|
| `backup` | Transmite dumps de BD + respalda rutas/configs. |
| `prune` | `restic forget --prune` con retención. |
| `check` | `restic check` — integridad estructural. |
| `drill` | Restaura el snapshot más reciente y compara. |

## Un trabajo por repositorio

Dos programaciones que se disparan a la vez sobre el mismo repositorio se
serializan. Repositorios distintos corren en paralelo. Prune es un trabajo
aparte — nunca dentro de un backup.

## Retención → `forget`

```
keepDaily/keepWeekly/keepMonthly → --keep-daily/--keep-weekly/--keep-monthly
```

## Registros en vivo

Cada trabajo transmite el stdout/stderr de restic vía Socket.IO en
`/scheduler`. Únete a la sala del trabajo con tu JWT — solo tus trabajos.

## Recuperación

Tras un fallo, el próximo reintento detecta el bloqueo huérfano y ejecuta
`restic unlock` de forma segura.
