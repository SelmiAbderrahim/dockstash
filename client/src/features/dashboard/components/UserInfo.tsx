interface UserInfoProps {
  profile: string | undefined;
}

export const UserInfo = ({ profile }: UserInfoProps) => <div>{profile}</div>;
