/** Comma-separated emails promoted to `admin` on signup / seed (case-insensitive). */
export function getBootstrapAdminEmails(): string[] {
  const raw = process.env.STARFORGE_ADMIN_EMAILS || ''
  return raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function emailIsBootstrapAdmin(email: string): boolean {
  const needle = email.trim().toLowerCase()
  return getBootstrapAdminEmails().includes(needle)
}
