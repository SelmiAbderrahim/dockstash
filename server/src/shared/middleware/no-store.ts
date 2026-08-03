import type { RequestHandler } from 'express';

// API JSON is per-user and mutates constantly (fleet lists, balances, tokens).
// Without an explicit directive, browsers and proxies apply *heuristic* caching
// and can replay a stale response after a mutation — e.g. a deleted agent
// reappearing in GET /api/agents/fleet because DELETE hit a different URL and
// never invalidated the list. `no-store` bars caching at every layer.
export const apiNoStore: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};
