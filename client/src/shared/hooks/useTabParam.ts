import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Persist tab state in the `?tab=` URL query parameter.
 *
 * Contract (see `.claude/rules/url-tab-state.md`):
 *   - `tab` is the only parameter key
 *   - default value applied when `?tab=` is absent
 *   - invalid values (not in `validTabs`) fall back to the default
 *   - switching a tab uses `navigate({search}, { replace: true })` so the
 *     browser history is not polluted per click
 */
export function useTabParam(
  defaultTab: string,
  validTabs?: readonly string[],
): [string, (next: string) => void] {
  const location = useLocation();
  const navigate = useNavigate();

  const activeTab = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const value = params.get('tab');
    if (!value) return defaultTab;
    if (validTabs && !validTabs.includes(value)) return defaultTab;
    return value;
  }, [location.search, defaultTab, validTabs]);

  const setActiveTab = useCallback(
    (next: string) => {
      const params = new URLSearchParams(location.search);
      params.set('tab', next);
      navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
    },
    [location.pathname, location.search, navigate],
  );

  return [activeTab, setActiveTab];
}
