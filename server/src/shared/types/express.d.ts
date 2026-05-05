import 'express';

declare global {
  namespace Express {
    interface Request {
      id: string;
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
