export interface EmailAddress {
  email: string;
  name?: string;
}

export interface SendEmailInput {
  to: EmailAddress | EmailAddress[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: EmailAddress;
}

export interface SendEmailResult {
  id: string;
  accepted: string[];
}

/** Provider-agnostic transactional email transport. */
export interface EmailTransport {
  readonly name: string;
  send(input: SendEmailInput): Promise<SendEmailResult>;
}
