/**
 * `?invite=<token>` post-auth handoff. Validated as a TOKEN, never a path — a
 * path-shaped or overlong value is dropped, so the param can never become an
 * open redirect. Mirrors the server's `invitationTokenParamsSchema`.
 */
export const inviteTokenFrom = (raw: string | null): string =>
  raw !== null && /^[A-Za-z0-9_-]{1,128}$/.test(raw) ? raw : '';
