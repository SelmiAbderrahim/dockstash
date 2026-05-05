import moment from 'moment';
import type { ConversationMessage } from '../types';
import { MessageItem } from './MessageItem';

interface MessageListProps {
  displayMessages: ConversationMessage[];
}

export const MessageList = ({ displayMessages }: MessageListProps) => (
  <div className="messages">
    {displayMessages.map((data) => (
      <MessageItem
        key={data._id}
        message={data.body}
        author={data.author}
        timestamp={moment(data.createdAt).from(moment())}
      />
    ))}
  </div>
);
