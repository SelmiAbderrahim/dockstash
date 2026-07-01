import { Avatar, AvatarFallback } from '@shared/ui/avatar';
import { Card, CardContent } from '@shared/ui/card';
import { Separator } from '@shared/ui/separator';

interface UserInfoProps {
  profile: string | undefined;
}

const initialsFor = (profile: string | undefined): string =>
  profile ? profile.slice(0, 2).toUpperCase() : '?';

export const UserInfo = ({ profile }: UserInfoProps) => (
  <Card className="w-full max-w-md">
    <CardContent className="flex items-center gap-4 pt-6">
      <Avatar size="lg">
        <AvatarFallback>{initialsFor(profile)}</AvatarFallback>
      </Avatar>
      <Separator orientation="vertical" className="h-10" />
      <span className="text-foreground text-sm font-medium">{profile}</span>
    </CardContent>
  </Card>
);
