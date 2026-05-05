import { loadCookie } from '@shared/utils/cookies';
import type { MessageAuthor } from '../types';

interface MessageItemProps {
  message: string;
  author: MessageAuthor;
  timestamp: string;
}

interface CookieUser {
  _id?: string;
}

export const MessageItem = ({ message, author, timestamp }: MessageItemProps) => {
  const currentUser = loadCookie<CookieUser>('user');
  const isCurrentUser = currentUser?._id === author._id;

  return (
    <div className={isCurrentUser ? 'message current-user' : 'message'}>
      <span className="message-body">{message}</span>
      <br />
      <span className="message-byline">
        From {author.profile.firstName} {author.profile.lastName} | {timestamp}
      </span>
    </div>
  );
};
