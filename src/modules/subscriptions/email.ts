import 'server-only'

/** Subscription mail — Email Manager only. Never call getMailer() here. */

export async function emitSubscriptionsEmail(
  triggerKey: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const { emitEmailTrigger, isEmailManagerEnabled } = await import(
      '@/modules/email-manager/api.server'
    )
    if (!(await isEmailManagerEnabled())) return
    await emitEmailTrigger({ triggerKey, payload })
  } catch {
    // Soft-fail — period state must not depend on mail.
  }
}
