import { HttpError } from './http-error.js';

export function requireUserId(user: Express.User | undefined): string {
  if (!user) throw HttpError.unauthorized('errors.unauthorized');
  return user.id;
}
