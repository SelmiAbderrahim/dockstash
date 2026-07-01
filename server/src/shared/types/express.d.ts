import 'express';
import type { SupportedLocale, TranslationVars } from '../i18n/index.js';

declare global {
  namespace Express {
    interface Request {
      id: string;
      language: SupportedLocale;
      t: (key: string, vars?: TranslationVars) => string;
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
