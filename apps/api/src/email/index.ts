import { env } from "../config.js";
import { ConsoleEmailTransport } from "./console-transport.js";
import { SmtpEmailTransport } from "./smtp-transport.js";
import type { EmailTransport, SendEmailInput } from "./types.js";

export type { EmailTransport, SendEmailInput } from "./types.js";

let transport: EmailTransport | null = null;

export function getEmailTransport(): EmailTransport {
  if (transport) return transport;
  transport =
    env.EMAIL_TRANSPORT === "smtp" ? new SmtpEmailTransport() : new ConsoleEmailTransport();
  return transport;
}

/** High-level helper used by domain services. */
export async function sendTransactionalEmail(input: SendEmailInput) {
  return getEmailTransport().send(input);
}
