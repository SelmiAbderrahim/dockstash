import type { RootState } from '@app/store';
import type { ConversationGroup, ConversationMessage, Recipient } from '../types';

export const selectConversations = (state: RootState): ConversationGroup[] =>
  state.messaging.conversations;
export const selectMessages = (state: RootState): ConversationMessage[] => state.messaging.messages;
export const selectRecipients = (state: RootState): Recipient[] => state.messaging.recipients;
export const selectMessagingError = (state: RootState): string => state.messaging.error;
export const selectMessagingMessage = (state: RootState): string => state.messaging.message;
