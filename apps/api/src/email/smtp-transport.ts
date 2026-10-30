import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env } from "../config.js";
import type { EmailTransport, SendEmailInput, SendEmailResult } from "./types.js";

function toSmtpAddress(addr: { email: string; name?: string }) {
  return addr.name ? { name: addr.name, address: addr.email } : addr.email;
}

/** SMTP transport for real outbound mail (Mailhog, SES SMTP, etc.). */
export class SmtpEmailTransport implements EmailTransport {
  readonly name = "smtp";
  private transporter: Transporter;

  constructor() {
    if (!env.SMTP_HOST) {
      throw new Error("SMTP_HOST is required when EMAIL_TRANSPORT=smtp");
    }
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      secure: env.SMTP_SECURE ?? false,
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : undefined,
    });
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const toList = Array.isArray(input.to) ? input.to : [input.to];
    const info = await this.transporter.sendMail({
      from: env.EMAIL_FROM,
      to: toList.map(toSmtpAddress),
      subject: input.subject,
      text: input.text,
      html: input.html,
      replyTo: input.replyTo ? toSmtpAddress(input.replyTo) : undefined,
    });

    return {
      id: String(info.messageId ?? ""),
      accepted: (info.accepted ?? []).map(String),
    };
  }
}
