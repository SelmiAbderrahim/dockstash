# Environment Variables - Strict Rule

## MANDATORY REQUIREMENT - ZERO TOLERANCE

**ONLY use root `.env` file. NEVER create or use `.env`, `.env.local`, or any subdirectory `.env` files.**

## Architecture

```
mern-starter/
├── .env                 # ONLY environment file (single source of truth)
├── .env.example         # Template only — committed to git
├── client/              # NO .env files allowed here
└── server/              # NO .env files allowed here
```

The server loads variables at startup via `dotenv` (or equivalent) from the root `.env`. The client does NOT read `.env` directly — API URLs and feature flags come from the server API or are baked in at build time via Webpack's `DefinePlugin`.

## Why This Rule Exists

1. **Single source of truth** — No conflicts, no duplicate values
2. **Security** — One file to secure, audit, and manage
3. **Maintainability** — Clear ownership and updates

## Required Variables

All defined in root `.env`:

| Variable | Purpose | Example |
|----------|---------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/myapp` |
| `JWT_SECRET` | Token signing key | random 64-char hex string |
| `SESSION_SECRET` | Session encryption key | random 64-char hex string |
| `PORT` | Server listen port | `5000` |
| `NODE_ENV` | Runtime environment | `development` or `production` |
| `CLIENT_URL` | Frontend origin (for CORS) | `http://localhost:3000` |
| `SERVER_URL` | Backend origin | `http://localhost:5000` |

## Agent Responsibilities

1. **Never create** `.env` or `.env.local` files in subdirectories
2. **Only edit** root `.env` file for new variables
3. **Document** new variables in root `.env.example` with comments
4. **Verify** `.gitignore` includes `.env`

## Validation Checklist

- [ ] No `client/.env` or `server/.env` files exist
- [ ] Root `.env` has all required variables
- [ ] `.gitignore` includes `.env`
- [ ] `.env.example` is up to date with all variables (minus secrets)

## Summary

> **Root `.env` ONLY. Subdirectory `.env` files are FORBIDDEN.**
