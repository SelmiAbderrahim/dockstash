export interface MessageAuthorProfile {
  firstName: string;
  lastName: string;
}

export interface MessageAuthor {
  _id: string;
  profile: MessageAuthorProfile;
}

export interface ConversationMessage {
  _id: string;
  body: string;
  conversationId: string;
  author: MessageAuthor;
  createdAt: string;
}

export type ConversationGroup = ConversationMessage[];

export interface Recipient {
  _id: string;
  profile: MessageAuthorProfile;
}

export interface MessagingState {
  conversations: ConversationGroup[];
  messages: ConversationMessage[];
  recipients: Recipient[];
  message: string;
  error: string;
  activeConversationId: string;
}

export interface FetchConversationsResponse {
  conversations: ConversationGroup[];
}

export interface FetchSingleConversationResponse {
  conversation: ConversationMessage[];
}

export interface FetchRecipientsResponse {
  recipients: Recipient[];
}

export interface StartConversationResponse {
  message: string;
  conversationId: string;
}

export interface SendReplyResponse {
  message: string;
}
