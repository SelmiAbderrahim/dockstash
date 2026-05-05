import moment from 'moment';
import type { ConversationGroup } from '../types';
import { ConversationItem } from './ConversationItem';

interface ConversationListProps {
  conversations: ConversationGroup[];
}

export const ConversationList = ({ conversations }: ConversationListProps) => (
  <div className="messages">
    {conversations.map((group) =>
      group.map((message) => (
        <ConversationItem
          key={message._id}
          message={message.body}
          authorId={message.author._id}
          conversationId={message.conversationId}
          author={`${message.author.profile.firstName} ${message.author.profile.lastName.substring(0, 1)}.`}
          timestamp={moment(message.createdAt).from(moment())}
        />
      )),
    )}
  </div>
);
