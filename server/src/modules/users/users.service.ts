import { HttpError } from '../../shared/utils/http-error.js';
import { User, type UserHydrated } from './users.model.js';

export type PublicUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  emailVerified: boolean;
};

export function toPublicUser(user: UserHydrated): PublicUser {
  return {
    id: user._id.toString(),
    email: user.email,
    firstName: user.profile?.firstName ?? '',
    lastName: user.profile?.lastName ?? '',
    role: user.role,
    emailVerified: user.emailVerified ?? false,
  };
}

export async function findUserById(userId: string): Promise<UserHydrated | null> {
  return User.findById(userId);
}

export async function getUserProfile(userId: string): Promise<PublicUser> {
  const user = await User.findById(userId);
  if (!user) throw HttpError.notFound('errors.userNotFound');
  return toPublicUser(user);
}
