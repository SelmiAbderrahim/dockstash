# OAuth Sign-In Setup (Google & GitHub)

Dockstash supports one-click sign-in / sign-up with Google and GitHub. The
feature is **optional and off by default**: a provider is enabled only when
both its client ID and client secret are present in the environment. When a
provider is not configured, its button simply does not appear on the login
and register pages — nothing else changes.

This guide walks through creating the OAuth apps at Google and GitHub,
wiring the credentials into Dockstash, and verifying the flow end to end.

## 1. How the flow works (30-second version)

1. The browser navigates to `GET /api/auth/<provider>/start` on the API.
2. The API sets a short-lived (10 min) state cookie and redirects to the
   provider's consent screen.
3. The provider redirects back to
   `GET /api/auth/<provider>/callback` **on the API origin** (`SERVER_URL`).
4. The API validates the state, exchanges the code, fetches the verified
   email, finds-or-creates the account, and redirects to
   `CLIENT_URL/oauth/callback#token=…` where the SPA completes the session.

Two values in your root `.env` therefore drive every URL you will register
with the providers:

| Env var | Meaning | Local compose default | Production (dockstash.com) |
|---|---|---|---|
| `SERVER_URL` | API origin — receives the provider callback | `http://localhost:8080` | `https://dockstash.com` |
| `CLIENT_URL` | SPA origin — receives the final redirect | `http://localhost:3000` | `https://dockstash.com` |

The redirect URIs you must register are always:

```
${SERVER_URL}/api/auth/google/callback
${SERVER_URL}/api/auth/github/callback
```

Account behavior:

- If the provider email matches an existing password account, the provider
  is **auto-linked** to that account and the user is signed in (the email is
  provider-verified, and email control is already the trust root via
  password reset).
- New OAuth accounts are created with `emailVerified: true` — no
  verification email round-trip.
- OAuth-only accounts have a random unusable password; "Forgot password?"
  later gives them a real one (hybrid login).
- Superadmin accounts keep their email-OTP second factor: an OAuth login
  from an unknown device still lands on the OTP form.

## 2. Google Cloud Console

1. Go to <https://console.cloud.google.com/> and create (or select) a
   project, e.g. `dockstash`.
2. **OAuth consent screen** (APIs & Services → OAuth consent screen):
   - User type: **External**, then Create.
   - App name, support email, developer email: fill in.
   - Scopes: add the non-sensitive defaults
     `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`.
     Dockstash requests nothing else.
   - While the app is in **Testing** status only listed test users can sign
     in — add your own account under *Test users*, or click **Publish app**
     for production.
3. **Credentials** (APIs & Services → Credentials):
   - *Create credentials → OAuth client ID*.
   - Application type: **Web application**. Name it per environment
     (e.g. `dockstash-local`, `dockstash-prod`).
   - **Authorized JavaScript origins** — add your `CLIENT_URL` origin(s):
     - `http://localhost:3000` (local)
     - `https://dockstash.com` (production)
   - **Authorized redirect URIs** — add the API callback for the matching
     environment:
     - `http://localhost:8080/api/auth/google/callback` (local)
     - `https://dockstash.com/api/auth/google/callback` (production)
   - Create, then copy the **Client ID** and **Client secret**.

One client per environment is cleanest (separate local/prod), but Google
does allow multiple origins + redirect URIs on a single client if you prefer
one shared client.

## 3. GitHub OAuth App

1. Go to <https://github.com/settings/developers> →
   **OAuth Apps** → **New OAuth App**.
   (For an organization-owned app: Org → Settings → Developer settings.)
2. Fill in:
   - **Application name**: e.g. `Dockstash (local)` / `Dockstash`.
   - **Homepage URL**: your `CLIENT_URL`, e.g. `https://dockstash.com`.
   - **Authorization callback URL**:
     `${SERVER_URL}/api/auth/github/callback`, e.g.
     `http://localhost:8080/api/auth/github/callback` for local or
     `https://dockstash.com/api/auth/github/callback` for production.
3. Register, then **Generate a new client secret**. Copy the **Client ID**
   and the secret immediately (the secret is shown once).

> **One app per environment.** A GitHub OAuth App accepts only ONE callback
> URL, so create separate apps for local development and production.

Dockstash requests the `read:user` and `user:email` scopes and requires a
**verified primary email** on the GitHub account — users without one get a
clear "verified email unavailable" error and can register with a password
instead.

## 4. Wire the credentials into Dockstash

All configuration lives in the **root `.env`** (never a subdirectory
`.env`):

```env
GOOGLE_CLIENT_ID=1234567890-abc123.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GITHUB_CLIENT_ID=Iv1.abc123 # or the classic 20-char hex id
GITHUB_CLIENT_SECRET=ghp_-style-40-char-secret
```

Leave any pair empty to keep that provider disabled.

The compose file passes these through to the `api` service
(`docker-compose.yml` → `api.environment` → `GOOGLE_CLIENT_ID:
${GOOGLE_CLIENT_ID:-}` …). Empty strings are treated as unset, so the free /
self-host stack boots fine without them.

Apply the change:

```bash
docker compose up -d --force-recreate api
```

## 5. Verify

```bash
# 1. Capability probe — the flags the client uses to show/hide the buttons:
curl -s http://localhost:8080/api/auth/providers
# → {"google":true,"github":true}

# 2. Start leg — expect a 302 to the provider + an oauth_state cookie:
curl -sI http://localhost:8080/api/auth/google/start | grep -iE 'location|set-cookie'

# 3. Error handoff — expect a 302 back into the SPA with an error fragment:
curl -sI "http://localhost:8080/api/auth/google/callback?error=access_denied" | grep -i location
# → Location: http://localhost:3000/oauth/callback#error=accessDenied
```

Browser end-to-end:

1. Open `/login` — "Continue with Google" / "Continue with GitHub" buttons
   appear under the form (only for configured providers).
2. Click one, approve the consent screen, and you should land on
   `/dashboard`, already verified.
3. Sign in with a provider whose email matches an existing password
   account: the account is linked (the user document gains
   `googleId`/`githubId`) and both login methods keep working.
4. Superadmin check: from a fresh browser, an OAuth login as the superadmin
   lands on the OTP code form, exactly like a password login.

## 6. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `redirect_uri_mismatch` (Google) or "redirect_uri is not associated" (GitHub) | The callback URL registered at the provider does not exactly match `${SERVER_URL}/api/auth/<provider>/callback` — scheme, host, port and path must all match. Fix the provider app or your `SERVER_URL`. |
| Buttons don't appear on /login | `curl /api/auth/providers`. If flags are `false`: creds missing in root `.env`, or the compose passthrough is missing — both ID **and** secret must be non-empty, then `docker compose up -d --force-recreate api`. |
| `#error=invalidState` after consent | The 10-minute state window expired (user idled on the consent screen), cookies are blocked, or the flow started on a different host than it finished on. Retry the login; check that nothing strips cookies from `/api/auth`. |
| `#error=emailUnavailable` | Google account without a verified email (rare) or GitHub account without a **verified primary** email. Verify the email at the provider, or register with a password. |
| `429 Too Many Requests` during testing | The auth rate limiter (default 10 requests / 15 min per IP) counts the start + callback + refresh legs. Raise `RATE_LIMIT_AUTH_MAX` in `.env` for test environments. |
| Google shows "app not verified" warning | The consent screen is in Testing status or unpublished. Add test users, or publish the app. |

## 7. Security notes (what the implementation does for you)

- **CSRF**: the `state` parameter is a signed 10-minute JWT bound to the
  provider and a nonce that must also arrive in an `httpOnly`,
  `sameSite=lax` cookie scoped to `/api/auth`. Both must match at the
  callback.
- **Token handoff** uses the URL **fragment** (`#token=…`), which never
  reaches server logs, proxies, or `Referer` headers, and the SPA scrubs it
  from history immediately.
- Only the email, name, and provider subject ID are read from the provider.
  Access tokens are used for the profile fetch and discarded — nothing
  provider-side is stored.
- Client secrets live only in the root `.env` on the server; never commit
  them (the file is gitignored) and rotate them at the provider if leaked.
