import { apiClient } from '@shared/api/client';
import type {
  FetchConversationsResponse,
  FetchRecipientsResponse,
  FetchSingleConversationResponse,
  SendReplyResponse,
  StartConversationResponse,
} from './types';

export const fetchConversationsRequest = (): Promise<FetchConversationsResponse> =>
  apiClient<FetchConversationsResponse>('/chat', { auth: true });

export const fetchConversationRequest = (
  conversationId: string,
): Promise<FetchSingleConversationResponse> =>
  apiClient<FetchSingleConversationResponse>(`/chat/${conversationId}`, { auth: true });

export const fetchRecipientsRequest = (): Promise<FetchRecipientsResponse> =>
  apiClient<FetchRecipientsResponse>('/chat/recipients', { auth: true });

export const startConversationRequest = (
  recipient: string,
  composedMessage: string,
): Promise<StartConversationResponse> =>
  apiClient<StartConversationResponse>(`/chat/new/${recipient}`, {
    method: 'POST',
    auth: true,
    body: { composedMessage },
  });

export const sendReplyRequest = (
  replyTo: string,
  composedMessage: string,
): Promise<SendReplyResponse> =>
  apiClient<SendReplyResponse>(`/chat/${replyTo}`, {
    method: 'POST',
    auth: true,
    body: { composedMessage },
  });
