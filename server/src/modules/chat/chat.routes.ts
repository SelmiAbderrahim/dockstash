import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import {
  getConversation,
  listConversations,
  newConversation,
  sendReply,
} from './chat.controller.js';

export const chatRouter: Router = Router();

chatRouter.get('/', requireAuth, listConversations);
chatRouter.get('/:conversationId', requireAuth, getConversation);
chatRouter.post('/:conversationId', requireAuth, sendReply);
chatRouter.post('/new/:recipient', requireAuth, newConversation);
