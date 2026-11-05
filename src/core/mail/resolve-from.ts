/**
 * Resolve outbound From: Site Chrome first, then STARFORGE_MAIL_FROM.
 * Chrome From may be missing on older/cached docs — never call trim on undefined.
 */
export function resolveFrom(chromeFrom: string | undefined | null): string {
  const chrome = (chromeFrom ?? '').trim()
  if (chrome) return chrome
  return (process.env.STARFORGE_MAIL_FROM ?? '').trim()
}
