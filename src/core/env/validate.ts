/**
 * Boot-time environment contract (design-data-deploy §3 / SF-139).
 * Pure — no DB / Redis I/O. Safe for unit tests and `instrumentation.ts`.
 */

export type EnvIssueLevel = 'error' | 'warn'

export type EnvIssue = {
  level: EnvIssueLevel
  key: string
  message: string
}

export type EnvValidationResult = {
  ok: boolean
  errors: EnvIssue[]
  warnings: EnvIssue[]
}

function trim(key: string, env: NodeJS.ProcessEnv = process.env): string {
  return (env[key] ?? '').trim()
}

function isProduction(env: NodeJS.ProcessEnv): boolean {
  return (env.NODE_ENV ?? '').trim() === 'production'
}

function looksHttps(url: string): boolean {
  return /^https:\/\//i.test(url)
}

function looksHttp(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

/**
 * Validate Starforge process env against the deploy contract.
 * Pass `env` in tests; defaults to `process.env`.
 */
export function validateStarforgeEnv(
  env: NodeJS.ProcessEnv = process.env,
): EnvValidationResult {
  const errors: EnvIssue[] = []
  const warnings: EnvIssue[] = []
  const prod = isProduction(env)

  const requireNonEmpty = (key: string, opts?: { minLength?: number }) => {
    const value = trim(key, env)
    if (!value) {
      errors.push({ level: 'error', key, message: `${key} is required.` })
      return ''
    }
    if (opts?.minLength && value.length < opts.minLength) {
      errors.push({
        level: 'error',
        key,
        message: `${key} must be at least ${opts.minLength} characters.`,
      })
    }
    return value
  }

  // --- Core (required in production; warn in dev when missing) ---
  const coreKeys = [
    'DATABASE_URL',
    'PAYLOAD_SECRET',
    'BETTER_AUTH_SECRET',
  ] as const

  for (const key of coreKeys) {
    const value = trim(key, env)
    if (!value) {
      const issue: EnvIssue = {
        level: prod ? 'error' : 'warn',
        key,
        message: `${key} is missing.`,
      }
      ;(prod ? errors : warnings).push(issue)
      continue
    }
    if (
      (key === 'PAYLOAD_SECRET' || key === 'BETTER_AUTH_SECRET') &&
      value.length < 32
    ) {
      const issue: EnvIssue = {
        level: prod ? 'error' : 'warn',
        key,
        message: `${key} should be at least 32 characters.`,
      }
      ;(prod ? errors : warnings).push(issue)
    }
  }

  const authUrl = trim('BETTER_AUTH_URL', env) || trim('NEXT_PUBLIC_APP_URL', env)
  if (!authUrl) {
    const issue: EnvIssue = {
      level: prod ? 'error' : 'warn',
      key: 'BETTER_AUTH_URL',
      message: 'BETTER_AUTH_URL or NEXT_PUBLIC_APP_URL is required.',
    }
    ;(prod ? errors : warnings).push(issue)
  } else if (!looksHttp(authUrl)) {
    errors.push({
      level: 'error',
      key: 'BETTER_AUTH_URL',
      message: 'BETTER_AUTH_URL / NEXT_PUBLIC_APP_URL must be an http(s) URL.',
    })
  } else if (prod && !looksHttps(authUrl) && trim('STARFORGE_SECURE_COOKIES', env) !== '0') {
    errors.push({
      level: 'error',
      key: 'BETTER_AUTH_URL',
      message:
        'Production app URL must be https:// (or set STARFORGE_SECURE_COOKIES=0 only for deliberate HTTP).',
    })
  }

  // --- Cookies / origins (optional) ---
  const trustedProxy = trim('STARFORGE_TRUSTED_PROXY_HOPS', env)
  if (trustedProxy && !/^\d+$/.test(trustedProxy)) {
    warnings.push({
      level: 'warn',
      key: 'STARFORGE_TRUSTED_PROXY_HOPS',
      message: 'STARFORGE_TRUSTED_PROXY_HOPS should be a non-negative integer.',
    })
  }

  // --- Admin ---
  if (!trim('STARFORGE_DEVELOPER_ADMIN_EMAILS', env)) {
    warnings.push({
      level: 'warn',
      key: 'STARFORGE_DEVELOPER_ADMIN_EMAILS',
      message:
        'STARFORGE_DEVELOPER_ADMIN_EMAILS is empty — Environment editor / script fields fall back to all app admins (or nobody when none).',
    })
  }

  // --- Cache / Redis ---
  const cache = trim('STARFORGE_CONTENT_CACHE', env).toLowerCase()
  if (cache === 'redis' && !trim('REDIS_URL', env)) {
    const issue: EnvIssue = {
      level: prod ? 'error' : 'warn',
      key: 'REDIS_URL',
      message: 'REDIS_URL is required when STARFORGE_CONTENT_CACHE=redis.',
    }
    ;(prod ? errors : warnings).push(issue)
  }

  // --- Media ---
  const media = trim('STARFORGE_MEDIA_STORAGE', env).toLowerCase()
  if (media === 's3') {
    for (const key of [
      'S3_ENDPOINT',
      'S3_BUCKET',
      'S3_ACCESS_KEY_ID',
      'S3_SECRET_ACCESS_KEY',
    ] as const) {
      if (!trim(key, env)) {
        // Design: throw instead of silent local-disk fallback.
        errors.push({
          level: 'error',
          key,
          message: `${key} is required when STARFORGE_MEDIA_STORAGE=s3 (no silent local fallback).`,
        })
      }
    }
  }

  // --- Captcha (warn when one half set) ---
  const turnstileSite = trim('NEXT_PUBLIC_TURNSTILE_SITE_KEY', env)
  const turnstileSecret = trim('TURNSTILE_SECRET_KEY', env)
  if (turnstileSite && !turnstileSecret) {
    warnings.push({
      level: 'warn',
      key: 'TURNSTILE_SECRET_KEY',
      message: 'TURNSTILE_SECRET_KEY missing while site key is set.',
    })
  }
  if (turnstileSecret && !turnstileSite) {
    warnings.push({
      level: 'warn',
      key: 'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
      message: 'NEXT_PUBLIC_TURNSTILE_SITE_KEY missing while secret is set.',
    })
  }

  // --- Mail (warn when SMTP/Resend half-configured) ---
  if (trim('SMTP_HOST', env) && !trim('SMTP_PORT', env)) {
    warnings.push({
      level: 'warn',
      key: 'SMTP_PORT',
      message: 'SMTP_HOST is set but SMTP_PORT is empty.',
    })
  }

  // Touch requireNonEmpty helper so tree-shaking keeps the shape for future hard rules.
  void requireNonEmpty

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Apply validation for the current process.
 * Production: throw on errors. Development: console.warn.
 */
export function assertStarforgeEnvAtBoot(
  env: NodeJS.ProcessEnv = process.env,
): EnvValidationResult {
  const result = validateStarforgeEnv(env)
  for (const w of result.warnings) {
    console.warn(`[starforge:env] ${w.key}: ${w.message}`)
  }
  if (!result.ok) {
    const detail = result.errors.map((e) => `${e.key}: ${e.message}`).join('\n')
    if (isProduction(env)) {
      throw new Error(`Starforge environment validation failed:\n${detail}`)
    }
    for (const e of result.errors) {
      console.warn(`[starforge:env] ERROR ${e.key}: ${e.message}`)
    }
  }
  return result
}
