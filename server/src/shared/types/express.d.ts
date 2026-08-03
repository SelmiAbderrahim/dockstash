import 'express';
import type { SupportedLocale, TranslationVars } from '../i18n/index.js';
import type { AgentPrincipal } from '../middleware/require-agent-auth.js';

declare global {
  namespace Express {
    interface Request {
      id: string;
      language: SupportedLocale;
      t: (key: string, vars?: TranslationVars) => string;
      // Set by require-agent-auth on the /api/agent machine surface only.
      agent?: AgentPrincipal;
    }

    // Augments passport's empty User type so req.user is strongly typed.
    interface User {
      id: string;
      email?: string;
      role?: string;
    }
  }
}

export {};
