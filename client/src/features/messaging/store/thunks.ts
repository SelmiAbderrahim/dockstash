import { createAsyncThunk } from '@reduxjs/toolkit';
import { messageFromError } from '@shared/utils/errors';
import {
  fetchConversationRequest,
  fetchConversationsRequest,
  fetchRecipientsRequest,
  sendReplyRequest,
  startConversationRequest,
} from '../api';
import type {
  ConversationGroup,
  ConversationMessage,
  Recipient,
  StartConversationResponse,
} from '../types';

export const fetchConversations = createAsyncThunk<
  ConversationGroup[],
  void,
  { rejectValue: string }
>('messaging/fetchConversations', async (_, { rejectWithValue }) => {
  try {
    const data = await fetchConversationsRequest();
    return data.conversations;
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not load conversations.'));
  }
});

export const fetchConversation = createAsyncThunk<
  ConversationMessage[],
  string,
  { rejectValue: string }
>('messaging/fetchConversation', async (conversationId, { rejectWithValue }) => {
  try {
    const data = await fetchConversationRequest(conversationId);
    return data.conversation;
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not load conversation.'));
  }
});

export const fetchRecipients = createAsyncThunk<Recipient[], void, { rejectValue: string }>(
  'messaging/fetchRecipients',
  async (_, { rejectWithValue }) => {
    try {
      const data = await fetchRecipientsRequest();
      return data.recipients;
    } catch (err) {
      return rejectWithValue(messageFromError(err, 'Could not load recipients.'));
    }
  },
);

export const startConversation = createAsyncThunk<
  StartConversationResponse,
  { recipient: string; composedMessage: string },
  { rejectValue: string }
>('messaging/startConversation', async ({ recipient, composedMessage }, { rejectWithValue }) => {
  try {
    return await startConversationRequest(recipient, composedMessage);
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not start conversation.'));
  }
});

export const sendReply = createAsyncThunk<
  string,
  { replyTo: string; composedMessage: string },
  { rejectValue: string }
>('messaging/sendReply', async ({ replyTo, composedMessage }, { rejectWithValue }) => {
  try {
    const data = await sendReplyRequest(replyTo, composedMessage);
    return data.message;
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not send reply.'));
  }
});
