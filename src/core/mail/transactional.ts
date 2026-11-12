/**
 * Plain-text + simple HTML for auth and other transactional mail.
 * Transport stays the Mailer port. This is not an Email Manager template.
 */

export function escapeTransactionalHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Keep blank lines. Drop only null/undefined. URLs become anchors. */
export function renderTransactionalMail(
  lines: Array<string | null | undefined>,
): { text: string; html: string } {
  const kept = lines.filter((line): line is string => line != null)
  const text = kept.join('\n')
  const html = kept
    .filter((line) => line.length > 0)
    .map((line) => {
      const safe = escapeTransactionalHtml(line)
      if (/^https?:\/\//i.test(line)) {
        return `<p><a href="${safe}">${safe}</a></p>`
      }
      return `<p>${safe}</p>`
    })
    .join('\n')
  return { text, html }
}
