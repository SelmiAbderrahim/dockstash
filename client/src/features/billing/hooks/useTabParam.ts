import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Persist the active tab in `?tab=<name>` per `.claude/rules/url-tab-state.md`.
 * `replace: true` so tab switches never pollute browser history. Unknown
 * values fall back to the default.
 */
export function useTabParam<T extends string>(defaultTab: T, valid: readonly T[]): [T, (t: T) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const raw = params.get('tab');
  const active: T = (raw && (valid as readonly string[]).includes(raw) ? raw : defaultTab) as T;

  const setTab = useCallback(
    (tab: T) => {
      const next = new URLSearchParams(location.search);
      next.set('tab', tab);
      navigate({ search: next.toString() }, { replace: true });
    },
    [location.search, navigate],
  );

  return [active, setTab];
}
