import { randomUUID } from "node:crypto";
import type { EmailTransport, SendEmailInput, SendEmailResult } from "./types.js";

function formatAddress(addr: SendEmailInput["to"]): string {
  const list = Array.isArray(addr) ? addr : [addr];
  return list.map((a) => (a.name ? `${a.name} <${a.email}>` : a.email)).join(", ");
}

/** Dev transport: prints the message to stdout instead of sending. */
export class ConsoleEmailTransport implements EmailTransport {
  readonly name = "console";

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const id = randomUUID();
    console.log("\n——— Starforge email (console) ———");
    console.log(`id:      ${id}`);
    console.log(`to:      ${formatAddress(input.to)}`);
    console.log(`subject: ${input.subject}`);
    console.log(`text:\n${input.text}`);
    if (input.html) {
      console.log(`html:\n${input.html}`);
    }
    console.log("———————————————————————————————\n");

    const accepted = (Array.isArray(input.to) ? input.to : [input.to]).map((a) => a.email);
    return { id, accepted };
  }
}
