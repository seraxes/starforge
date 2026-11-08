/**
 * product:profiles — field registry + pure validators (no DB / session).
 *
 * One registry drives the member editor, the admin editor, Settings, the privacy
 * projection, and the ecosystem API. Hero packs add vertical fields through the
 * `extensions` seam (see README) — they never fork this list.
 */

export const VISIBILITY_SCOPES = ['public', 'registered', 'friends', 'private'] as const
export type VisibilityScope = (typeof VISIBILITY_SCOPES)[number]

export function isVisibilityScope(value: unknown): value is VisibilityScope {
  return (
    typeof value === 'string' &&
    (VISIBILITY_SCOPES as readonly string[]).includes(value)
  )
}

export const VISIBILITY_LABELS: Record<VisibilityScope, string> = {
  public: 'Everyone',
  registered: 'Signed-in members',
  friends: 'Friends only',
  private: 'Only me',
}

export const PROFILE_FIELD_GROUPS = [
  { key: 'identity', label: 'Identity' },
  { key: 'about', label: 'About' },
  { key: 'personal', label: 'Personal' },
  { key: 'location', label: 'Location' },
  { key: 'contact', label: 'Contact & links' },
  { key: 'preferences', label: 'Preferences' },
] as const

export type ProfileFieldGroup = (typeof PROFILE_FIELD_GROUPS)[number]['key']

export type ProfileFieldKey =
  | 'displayName'
  | 'handle'
  | 'headline'
  | 'avatar'
  | 'cover'
  | 'bio'
  | 'birthDate'
  | 'gender'
  | 'country'
  | 'city'
  | 'location'
  | 'website'
  | 'phone'
  | 'links'
  | 'locale'
  | 'timezone'

export type ProfileFieldDef = {
  key: ProfileFieldKey
  label: string
  group: ProfileFieldGroup
  /** Always on, always public — cannot be hidden, disabled, or made optional. */
  locked?: boolean
  /** Never shown to anyone but the owner / admins (preferences). */
  selfOnly?: boolean
  defaultVisibility: VisibilityScope
}

export const PROFILE_FIELDS: readonly ProfileFieldDef[] = [
  { key: 'displayName', label: 'Display name', group: 'identity', locked: true, defaultVisibility: 'public' },
  { key: 'handle', label: 'Username', group: 'identity', locked: true, defaultVisibility: 'public' },
  { key: 'headline', label: 'Headline', group: 'identity', defaultVisibility: 'public' },
  { key: 'avatar', label: 'Avatar', group: 'identity', locked: true, defaultVisibility: 'public' },
  { key: 'cover', label: 'Cover image', group: 'identity', defaultVisibility: 'public' },
  { key: 'bio', label: 'Bio', group: 'about', defaultVisibility: 'public' },
  { key: 'birthDate', label: 'Date of birth (shown as age)', group: 'personal', defaultVisibility: 'private' },
  { key: 'gender', label: 'Gender', group: 'personal', defaultVisibility: 'private' },
  { key: 'country', label: 'Country', group: 'location', defaultVisibility: 'public' },
  { key: 'city', label: 'City', group: 'location', defaultVisibility: 'registered' },
  { key: 'location', label: 'Map location (approximate)', group: 'location', defaultVisibility: 'private' },
  { key: 'website', label: 'Website', group: 'contact', defaultVisibility: 'public' },
  { key: 'phone', label: 'Phone', group: 'contact', defaultVisibility: 'private' },
  { key: 'links', label: 'Social links', group: 'contact', defaultVisibility: 'public' },
  { key: 'locale', label: 'Language', group: 'preferences', selfOnly: true, defaultVisibility: 'private' },
  { key: 'timezone', label: 'Time zone', group: 'preferences', selfOnly: true, defaultVisibility: 'private' },
] as const

const FIELD_BY_KEY = new Map<string, ProfileFieldDef>(
  PROFILE_FIELDS.map((f) => [f.key, f]),
)

export function getProfileField(key: string): ProfileFieldDef | undefined {
  return FIELD_BY_KEY.get(key)
}

export function isProfileFieldKey(value: unknown): value is ProfileFieldKey {
  return typeof value === 'string' && FIELD_BY_KEY.has(value)
}

/** Fields whose visibility the member can change (not locked / self-only). */
export function isVisibilityConfigurable(key: ProfileFieldKey): boolean {
  const def = FIELD_BY_KEY.get(key)
  return Boolean(def && !def.locked && !def.selfOnly)
}

// ---------------------------------------------------------------------------
// Gender
// ---------------------------------------------------------------------------

export const GENDER_OPTIONS = [
  { value: '', label: 'Prefer not to say' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'nonbinary', label: 'Non-binary' },
] as const

export function normalizeGender(raw: unknown): string {
  const v = String(raw ?? '').trim().toLowerCase()
  return GENDER_OPTIONS.some((o) => o.value === v) ? v : ''
}

// ---------------------------------------------------------------------------
// Handle (username) — the public URL slug, lowercase, unique
// ---------------------------------------------------------------------------

export const HANDLE_MIN = 3
export const HANDLE_MAX = 30

const HANDLE_RE = /^[a-z0-9](?:[a-z0-9._-]{1,28})[a-z0-9]$/

/** Paths / words a handle may never take (route + brand safety). */
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  'admin', 'administrator', 'api', 'app', 'cms', 'root', 'system', 'support', 'staff',
  'moderator', 'mod', 'help', 'contact', 'about', 'legal', 'terms', 'privacy',
  'login', 'logout', 'register', 'signup', 'signin', 'account', 'settings', 'profile',
  'profiles', 'u', 'me', 'user', 'users', 'member', 'members', 'search', 'events',
  'event', 'marketplace', 'shop', 'groups', 'pages', 'feed', 'stream', 'media',
  'null', 'undefined', 'anonymous', 'starforge',
])

export function normalizeHandle(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase()
}

export type HandleCheck = { ok: true; handle: string } | { ok: false; error: string }

export function validateHandle(raw: unknown): HandleCheck {
  const handle = normalizeHandle(raw)
  if (handle.length < HANDLE_MIN) {
    return { ok: false, error: `Username must be at least ${HANDLE_MIN} characters.` }
  }
  if (handle.length > HANDLE_MAX) {
    return { ok: false, error: `Username must be at most ${HANDLE_MAX} characters.` }
  }
  if (!HANDLE_RE.test(handle)) {
    return {
      ok: false,
      error:
        'Use lowercase letters, numbers, dot, dash or underscore — starting and ending with a letter or number.',
    }
  }
  if (/[._-]{2,}/.test(handle)) {
    return { ok: false, error: 'Do not repeat dot, dash or underscore back to back.' }
  }
  if (RESERVED_HANDLES.has(handle)) {
    return { ok: false, error: 'That username is reserved.' }
  }
  return { ok: true, handle }
}

/** Derive a handle seed from a display name or email local-part. */
export function slugifyHandleBase(input: string): string {
  const ascii = String(input ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  let base = ascii
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, HANDLE_MAX - 6)
  if (base.length < HANDLE_MIN) base = `${base}user`.slice(0, HANDLE_MAX - 6)
  if (RESERVED_HANDLES.has(base)) base = `${base}-1`
  return base
}

// ---------------------------------------------------------------------------
// Simple value normalizers
// ---------------------------------------------------------------------------

/** Only http(s) URLs — never `javascript:` / `data:`. Empty string when invalid. */
export function normalizeHttpUrl(raw: unknown, max = 500): string {
  const value = String(raw ?? '').trim().slice(0, max)
  if (!value) return ''
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    return url.toString()
  } catch {
    return ''
  }
}

export type ProfileLink = { label: string; url: string }

export const PROFILE_LINKS_MAX = 6

export function normalizeProfileLinks(raw: unknown): ProfileLink[] {
  let list: unknown = raw
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(list)) return []
  const out: ProfileLink[] = []
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue
    const rec = entry as Record<string, unknown>
    const url = normalizeHttpUrl(rec.url)
    if (!url) continue
    const label = String(rec.label ?? '').trim().slice(0, 40)
    out.push({ label, url })
    if (out.length >= PROFILE_LINKS_MAX) break
  }
  return out
}

export function normalizeCountry(raw: unknown): string {
  const v = String(raw ?? '').trim().toUpperCase()
  return /^[A-Z]{2}$/.test(v) ? v : ''
}

export function normalizeText(raw: unknown, max: number): string {
  return String(raw ?? '').replace(/\r\n/g, '\n').trim().slice(0, max)
}

export function normalizePhone(raw: unknown): string {
  return String(raw ?? '')
    .replace(/[^\d+()\-\s.]/g, '')
    .trim()
    .slice(0, 32)
}

/** `YYYY-MM-DD` within a sane range, or '' when invalid / empty. */
export function normalizeBirthDate(raw: unknown, now = new Date()): string {
  const v = String(raw ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return ''
  const d = new Date(`${v}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return ''
  const year = d.getUTCFullYear()
  if (year < 1900 || d.getTime() > now.getTime()) return ''
  return v
}

/** Whole years on `now` (UTC), or null when no valid date. */
export function ageYears(birthDate: string, now = new Date()): number | null {
  const v = normalizeBirthDate(birthDate, now)
  if (!v) return null
  const [y, m, d] = v.split('-').map(Number)
  let age = now.getUTCFullYear() - y
  const beforeBirthday =
    now.getUTCMonth() + 1 < m || (now.getUTCMonth() + 1 === m && now.getUTCDate() < d)
  if (beforeBirthday) age -= 1
  return age >= 0 ? age : null
}

export function normalizeCoordinate(raw: unknown, min: number, max: number): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isFinite(n) || n < min || n > max) return null
  return n
}

/** ~1 km precision — what non-owners may ever see of a pin. */
export function roundCoordinate(n: number): number {
  return Math.round(n * 100) / 100
}

export function isValidTimezone(raw: string): boolean {
  if (!raw) return false
  try {
    new Intl.DateTimeFormat('en', { timeZone: raw })
    return true
  } catch {
    return false
  }
}
