# Passport JWT Algorithm Pin - Strict Rule

## MANDATORY REQUIREMENT - ZERO TOLERANCE

**The Passport `'jwt'` strategy MUST pin `algorithms: ['HS256']`. The server
MUST NOT contain a second `jwt.verify` path anywhere with a loose,
undefined, or expanded `algorithms` list.**

See `prompts/dockstash-security/01-auth-session-passport-jwt-opus-4.7.md` and
`docs/security-model.en.md` for the threat model.

## Why This Rule Exists

Without an explicit `algorithms` array, `jsonwebtoken` accepts:

1. **`alg:none`** — an unsigned token whose payload the attacker controls.
2. **Algorithm confusion** — a token signed with `RS256` whose payload was
   crafted against `HS256` using the server's public key as the HMAC secret.

Both bypass authentication. The `algorithms: ['HS256']` pin closes this
class of attack at the boundary. Passport-jwt's default is permissive.

## CORRECT

```ts
// server/src/modules/auth/passport.strategies.ts
new JwtStrategy(
  {
    jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme('jwt'),
    secretOrKey: env.JWT_SECRET,
    algorithms: ['HS256'],   // pin — rejects alg:none + RS256 confusion
  },
  verifyCallback,
);
```

Identity is always read via `passport.authenticate('jwt', {session: false})`
(mounted through `shared/middleware/require-auth.ts`). No hand-parsed tokens.
No second verify path.

## FORBIDDEN

```ts
// WRONG — no algorithms pin
new JwtStrategy({ secretOrKey: env.JWT_SECRET }, cb);

// WRONG — permissive list
new JwtStrategy({ secretOrKey: env.JWT_SECRET, algorithms: ['HS256', 'RS256'] }, cb);

// WRONG — alg:none is never valid
new JwtStrategy({ secretOrKey: env.JWT_SECRET, algorithms: ['none'] }, cb);

// WRONG — a second, hand-parsed verify path
import jwt from 'jsonwebtoken';
const payload = jwt.verify(token, env.JWT_SECRET);   // no algorithms → default any

// WRONG — reading identity off req.cookies without going through Passport
const id = req.cookies.userId;
```

## Validation

```bash
# Fails when the pin is missing / relaxed:
grep -nE "algorithms:\s*\[\s*'HS256'\s*\]" server/src/modules/auth/passport.strategies.ts

# Fails when a second verify path shows up in the server tree:
grep -rnE "jwt\.verify\(|jsonwebtoken" server/src \
  | grep -v node_modules \
  | grep -v \.test\. \
  | grep -v passport-jwt   # passport-jwt calls jwt.verify internally, that is fine
```

The static meta-test at
`server/src/shared/middleware/security-meta.test.ts` fails when either of
those checks regresses — do not silence it.

## Checklist

- [ ] `algorithms: ['HS256']` present in `passport.strategies.ts`
- [ ] No `jsonwebtoken` import outside `auth.service.ts` (signing) + tests
- [ ] No `jwt.verify` call anywhere except inside passport-jwt itself
- [ ] Every route reads identity via `passport.authenticate('jwt', …)`
- [ ] Meta-test at `security-meta.test.ts` green
