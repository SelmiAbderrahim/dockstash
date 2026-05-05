export interface UserProfile {
  _id?: string;
  email?: string;
  role?: string;
  firstName?: string;
  lastName?: string;
}

export interface DashboardState {
  profile: UserProfile;
  error: string;
}

export interface FetchUserResponse {
  user: UserProfile;
}
