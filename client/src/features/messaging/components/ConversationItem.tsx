import { Link } from 'react-router-dom';

interface ConversationItemProps {
  message: string;
  author: string;
  authorId: string;
  conversationId: string;
  timestamp: string;
}

export const ConversationItem = ({
  message,
  author,
  conversationId,
  timestamp,
}: ConversationItemProps) => (
  <div className="message">
    <Link to={`/dashboard/conversation/view/${conversationId}`}>
      <span className="message-body">{message}</span>
      <br />
      <span className="message-byline">
        From {author} | {timestamp}
      </span>
    </Link>
  </div>
);
