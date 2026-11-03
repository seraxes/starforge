/**
 * Allowlisted env keys editable from Core admin → Site Chrome → Environment.
 * Secrets never go to Postgres / Site Chrome / Payload — only `.env.local`.
 */

export type EnvEditorFieldKind = 'text' | 'password' | 'url' | 'enum'

export type EnvEditorField = {
  key: string
  label: string
  description: string
  /** Mask in UI; empty submit keeps existing value. */
  secret: boolean
  kind: EnvEditorFieldKind
  /** Optional fixed choices for enum fields. */
  options?: { value: string; label: string }[]
  /** Shown near the field when editing is dangerous. */
  warning?: string
  group: EnvEditorGroupId
}

export type EnvEditorGroupId =
  | 'core'
  | 'auth'
  | 'admins'
  | 'modules'
  | 'infra'
  | 'captcha'
  | 'mail'
  | 'editor'

export type EnvEditorGroup = {
  id: EnvEditorGroupId
  label: string
  hint: string
}

export const ENV_EDITOR_GROUPS: EnvEditorGroup[] = [
  {
    id: 'core',
    label: 'Database & CMS',
    hint: 'Connection and Payload secret. Wrong values break the site until you fix the file.',
  },
  {
    id: 'auth',
    label: 'Auth URLs & secret',
    hint: 'Better Auth + public app origin.',
  },
  {
    id: 'admins',
    label: 'Bootstrap admins',
    hint: 'Comma-separated emails. Developer list gates this Environment panel and script fields.',
  },
  {
    id: 'modules',
    label: 'Modules allowlist',
    hint: 'Optional override of starforge.modules.json for generate/predev/prebuild.',
  },
  {
    id: 'infra',
    label: 'Cache & media storage',
    hint: 'Leave unset for local defaults (Next tags / disk media).',
  },
  {
    id: 'captcha',
    label: 'Turnstile',
    hint: 'Chrome only enables/provider; keys live here.',
  },
  {
    id: 'mail',
    label: 'Outbound email secrets',
    hint: 'Chrome enable/provider/From; SMTP / Resend credentials here.',
  },
  {
    id: 'editor',
    label: 'Environment editor policy',
    hint: 'Production is read-only unless write is forced. off = read-only everywhere.',
  },
]

export const ENV_EDITOR_FIELDS: EnvEditorField[] = [
  {
    key: 'DATABASE_URL',
    label: 'DATABASE_URL',
    description: 'Postgres connection string (matches docker-compose locally).',
    secret: true,
    kind: 'password',
    warning: 'A bad URL locks Core DB access after restart.',
    group: 'core',
  },
  {
    key: 'PAYLOAD_SECRET',
    label: 'PAYLOAD_SECRET',
    description: 'Payload CMS signing secret — long random string.',
    secret: true,
    kind: 'password',
    warning: 'Changing this invalidates Payload admin tokens after restart.',
    group: 'core',
  },
  {
    key: 'BETTER_AUTH_SECRET',
    label: 'BETTER_AUTH_SECRET',
    description:
      'Better Auth signing secret (sole Starforge sign-in). Also used to sign the Environment unlock cookie.',
    secret: true,
    kind: 'password',
    warning: 'Changing this invalidates app sessions after restart.',
    group: 'auth',
  },
  {
    key: 'BETTER_AUTH_URL',
    label: 'BETTER_AUTH_URL',
    description: 'Canonical Better Auth base URL.',
    secret: false,
    kind: 'url',
    group: 'auth',
  },
  {
    key: 'NEXT_PUBLIC_APP_URL',
    label: 'NEXT_PUBLIC_APP_URL',
    description: 'Public site origin (also used when Better Auth URL is unset).',
    secret: false,
    kind: 'url',
    group: 'auth',
  },
  {
    key: 'STARFORGE_SECURE_COOKIES',
    label: 'STARFORGE_SECURE_COOKIES',
    description:
      'Force Secure session cookies (+ Better Auth __Secure- prefix, HSTS). Unset = derive from https:// app URL, else NODE_ENV=production. Use 0 for local http:// next start.',
    secret: false,
    kind: 'enum',
    options: [
      { value: '', label: '(auto — URL / NODE_ENV)' },
      { value: '1', label: '1 — force Secure' },
      { value: '0', label: '0 — force insecure (local HTTP)' },
    ],
    group: 'auth',
  },
  {
    key: 'STARFORGE_ADMIN_EMAILS',
    label: 'STARFORGE_ADMIN_EMAILS',
    description: 'Emails promoted to app admin (+ cms_access) on signup / seed / next request.',
    secret: false,
    kind: 'text',
    group: 'admins',
  },
  {
    key: 'STARFORGE_DEVELOPER_ADMIN_EMAILS',
    label: 'STARFORGE_DEVELOPER_ADMIN_EMAILS',
    description:
      'Emails allowed as developer-admins. Empty = all app admins (local default).',
    secret: false,
    kind: 'text',
    group: 'admins',
  },
  {
    key: 'SF_MODULES',
    label: 'SF_MODULES',
    description: 'Comma-separated catalog ids; when set, replaces starforge.modules.json.',
    secret: false,
    kind: 'text',
    group: 'modules',
  },
  {
    key: 'STARFORGE_CONTENT_CACHE',
    label: 'STARFORGE_CONTENT_CACHE',
    description: 'Published content cache backend. Unset = Next tags; redis needs REDIS_URL.',
    secret: false,
    kind: 'enum',
    options: [
      { value: '', label: '(default — Next tags)' },
      { value: 'redis', label: 'redis' },
    ],
    group: 'infra',
  },
  {
    key: 'REDIS_URL',
    label: 'REDIS_URL',
    description: 'Redis connection URL for content cache (and later rate-limit/queues). Secret if passworded.',
    secret: true,
    kind: 'password',
    group: 'infra',
  },
  {
    key: 'STARFORGE_MEDIA_STORAGE',
    label: 'STARFORGE_MEDIA_STORAGE',
    description: 'Media object storage. Unset/local = Payload /media disk.',
    secret: false,
    kind: 'enum',
    options: [
      { value: '', label: '(default — local disk)' },
      { value: 'local', label: 'local' },
      { value: 's3', label: 's3 (stub until hosting)' },
    ],
    group: 'infra',
  },
  {
    key: 'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
    label: 'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
    description: 'Cloudflare Turnstile site key (public).',
    secret: false,
    kind: 'text',
    group: 'captcha',
  },
  {
    key: 'TURNSTILE_SECRET_KEY',
    label: 'TURNSTILE_SECRET_KEY',
    description: 'Turnstile server secret — never Chrome DB.',
    secret: true,
    kind: 'password',
    group: 'captcha',
  },
  {
    key: 'STARFORGE_MAIL_FROM',
    label: 'STARFORGE_MAIL_FROM',
    description: 'Ops From override when Chrome From is empty.',
    secret: false,
    kind: 'text',
    group: 'mail',
  },
  {
    key: 'SMTP_HOST',
    label: 'SMTP_HOST',
    description: 'SMTP host for Mailer provider smtp.',
    secret: false,
    kind: 'text',
    group: 'mail',
  },
  {
    key: 'SMTP_PORT',
    label: 'SMTP_PORT',
    description: 'SMTP port (e.g. 587).',
    secret: false,
    kind: 'text',
    group: 'mail',
  },
  {
    key: 'SMTP_USER',
    label: 'SMTP_USER',
    description: 'SMTP username.',
    secret: false,
    kind: 'text',
    group: 'mail',
  },
  {
    key: 'SMTP_PASS',
    label: 'SMTP_PASS',
    description: 'SMTP password.',
    secret: true,
    kind: 'password',
    group: 'mail',
  },
  {
    key: 'SMTP_SECURE',
    label: 'SMTP_SECURE',
    description: 'Use TLS (true/false).',
    secret: false,
    kind: 'enum',
    options: [
      { value: '', label: '(unset)' },
      { value: 'false', label: 'false' },
      { value: 'true', label: 'true' },
    ],
    group: 'mail',
  },
  {
    key: 'RESEND_API_KEY',
    label: 'RESEND_API_KEY',
    description: 'Resend API key for Mailer provider resend.',
    secret: true,
    kind: 'password',
    group: 'mail',
  },
  {
    key: 'STARFORGE_ENV_EDITOR',
    label: 'STARFORGE_ENV_EDITOR',
    description:
      'write = allow saves in production; off/readonly = force read-only; unset = write only outside production.',
    secret: false,
    kind: 'enum',
    options: [
      { value: '', label: '(unset — prod read-only)' },
      { value: 'write', label: 'write' },
      { value: 'off', label: 'off' },
      { value: 'readonly', label: 'readonly' },
    ],
    group: 'editor',
  },
]

export const ENV_EDITOR_KEY_SET = new Set(ENV_EDITOR_FIELDS.map((f) => f.key))

export function getEnvEditorField(key: string): EnvEditorField | undefined {
  return ENV_EDITOR_FIELDS.find((f) => f.key === key)
}
