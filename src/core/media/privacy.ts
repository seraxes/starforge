/**
 * Media privacy helpers (client-safe).
 * Form respondent attachments use folder=forms + private=true.
 */

export function isPrivateFormMedia(doc: {
  folder?: string | null
  private?: boolean | null
}): boolean {
  if (doc.private === true) return true
  return (doc.folder ?? '') === 'forms'
}
