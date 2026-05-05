import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { fetchConversation } from '../store/thunks';
import { selectMessages } from '../store/selectors';
import { getSocket } from '../socket';
import { MessageList } from './MessageList';
import { ReplyMessage } from './ReplyMessage';

export const Conversation = () => {
  const dispatch = useAppDispatch();
  const messages = useAppSelector(selectMessages);
  const { conversationId } = useParams<{ conversationId: string }>();

  useEffect(() => {
    if (!conversationId) return;
    const socket = getSocket();
    void dispatch(fetchConversation(conversationId));
    socket.emit('enter conversation', conversationId);

    const refresh = () => {
      void dispatch(fetchConversation(conversationId));
    };
    socket.on('refresh messages', refresh);

    return () => {
      socket.off('refresh messages', refresh);
      socket.emit('leave conversation', conversationId);
    };
  }, [conversationId, dispatch]);

  if (!conversationId) {
    return <div>Conversation not found.</div>;
  }

  return (
    <div>
      <div className="panel panel-default">
        <div className="panel-body">
          <h4 className="left">Conversation with {conversationId}</h4>
          <Link className="right" to="/dashboard/inbox">
            Back to Inbox
          </Link>
          <div className="clearfix" />
          {messages.length > 0 ? <MessageList displayMessages={messages} /> : null}
        </div>
      </div>
      <ReplyMessage replyTo={conversationId} />
    </div>
  );
};
