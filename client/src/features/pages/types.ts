export interface PagesState {
  message: string;
  error: string;
}

export interface ContactFormBody {
  name: string;
  emailAddress: string;
  message: string;
}

export interface ContactFormResponse {
  message: string;
}
