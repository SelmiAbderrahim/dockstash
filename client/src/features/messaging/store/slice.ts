import { createSlice } from '@reduxjs/toolkit';
import type { MessagingState } from '../types';
import {
  fetchConversation,
  fetchConversations,
  fetchRecipients,
  sendReply,
  startConversation,
} from './thunks';

const initialState: MessagingState = {
  conversations: [],
  messages: [],
  recipients: [],
  message: '',
  error: '',
  activeConversationId: '',
};

const messagingSlice = createSlice({
  name: 'messaging',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.conversations = action.payload;
      })
      .addCase(fetchConversation.fulfilled, (state, action) => {
        state.messages = action.payload;
      })
      .addCase(fetchRecipients.fulfilled, (state, action) => {
        state.recipients = action.payload;
      })
      .addCase(startConversation.fulfilled, (state, action) => {
        state.message = action.payload.message;
        state.activeConversationId = action.payload.conversationId;
      })
      .addCase(sendReply.fulfilled, (state, action) => {
        state.message = action.payload;
      })
      .addCase(fetchConversations.rejected, (state, action) => {
        state.error = action.payload ?? 'Messaging error.';
      })
      .addCase(fetchConversation.rejected, (state, action) => {
        state.error = action.payload ?? 'Messaging error.';
      })
      .addCase(fetchRecipients.rejected, (state, action) => {
        state.error = action.payload ?? 'Messaging error.';
      })
      .addCase(startConversation.rejected, (state, action) => {
        state.error = action.payload ?? 'Messaging error.';
      })
      .addCase(sendReply.rejected, (state, action) => {
        state.error = action.payload ?? 'Messaging error.';
      });
  },
});

export const messagingReducer = messagingSlice.reducer;
