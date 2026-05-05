import type { RouteObject } from 'react-router-dom';
import { RequireAuth } from '@features/auth';
import { ComposeMessage } from './components/ComposeMessage';
import { Conversation } from './components/Conversation';
import { Inbox } from './components/Inbox';

export const messagingRoutes: RouteObject[] = [
  {
    path: 'dashboard/inbox',
    element: (
      <RequireAuth>
        <Inbox />
      </RequireAuth>
    ),
  },
  {
    path: 'dashboard/conversation/new',
    element: (
      <RequireAuth>
        <ComposeMessage />
      </RequireAuth>
    ),
  },
  {
    path: 'dashboard/conversation/view/:conversationId',
    element: (
      <RequireAuth>
        <Conversation />
      </RequireAuth>
    ),
  },
];
