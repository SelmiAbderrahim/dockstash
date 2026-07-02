export interface UserProfile {
  id?: string;
  email?: string;
  role?: string;
  firstName?: string;
  lastName?: string;
  guideMe?: boolean;
}

export interface FetchUserResponse {
  user: UserProfile;
}

export interface UpdateProfileResponse {
  user: UserProfile;
}
