/** Stable slug for `sf_user_groups.id` (and `group:<id>` nav access). */
export function slugifyGroupId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}
