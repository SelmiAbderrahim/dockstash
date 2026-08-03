import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Copy text to the clipboard with a fallback for insecure (HTTP) contexts.
 *
 * `navigator.clipboard` only exists in secure contexts (HTTPS or localhost).
 * Fleet dashboards are reached over bare `http://<vps-ip>:<port>`, where the
 * API is `undefined` — so we fall back to a hidden-textarea + `execCommand`
 * copy, the only path that works without a secure context.
 *
 * Returns `copied` (true for `resetMs` after a successful copy) and `copy`.
 */
export const useCopyToClipboard = (resetMs = 2000) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => clearTimer, []);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      let ok = false;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          ok = true;
        } catch {
          ok = false;
        }
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        textarea.style.pointerEvents = 'none';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          ok = document.execCommand('copy');
        } catch {
          ok = false;
        }
        document.body.removeChild(textarea);
      }

      if (ok) {
        clearTimer();
        setCopied(true);
        timerRef.current = setTimeout(() => {
          setCopied(false);
          timerRef.current = null;
        }, resetMs);
      }
      return ok;
    },
    [resetMs],
  );

  return { copied, copy };
};
