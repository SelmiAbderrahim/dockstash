import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { fetchConversations } from '../store/thunks';
import { selectConversations } from '../store/selectors';
import { ConversationList } from './ConversationList';

export const Inbox = () => {
  const dispatch = useAppDispatch();
  const conversations = useAppSelector(selectConversations);

  useEffect(() => {
    void dispatch(fetchConversations());
  }, [dispatch]);

  return (
    <div>
      <Link className="btn btn-primary" to="/dashboard/conversation/new">
        Compose Message
      </Link>
      <div className="panel panel-default">
        <div className="panel-body">
          {conversations.length > 0 ? (
            <ConversationList conversations={conversations} />
          ) : (
            <div>You do not have any active conversations.</div>
          )}
        </div>
      </div>
    </div>
  );
};
