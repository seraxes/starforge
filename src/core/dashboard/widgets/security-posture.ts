import type { CaptchaProviderId } from '@/core/security/captcha/types'

const CAPTCHA_GLANCE_LABEL: Record<CaptchaProviderId, string> = {
  none: 'None',
  turnstile: 'Turnstile',
  recaptcha: 'reCAPTCHA',
  hcaptcha: 'hCaptcha',
}

/**
 * Captcha posture chip for the Security glance card.
 * Disabled → Off; enabled → wired provider short label (Settings → Security).
 */
export function formatCaptchaPosture(
  enabled: boolean,
  provider: CaptchaProviderId | string | null | undefined,
): string {
  if (!enabled) return 'Off'
  const id = typeof provider === 'string' ? provider.trim() : ''
  if (!id) return 'On'
  return CAPTCHA_GLANCE_LABEL[id as CaptchaProviderId] ?? id
}

/**
 * Form submission rate-limit is always on today (Settings → Security stub).
 * Surface Redis vs in-memory when `REDIS_URL` is set — no fake off state.
 */
export function formatRateLimitPosture(redisUrl: string | undefined = process.env.REDIS_URL): string {
  const trimmed = typeof redisUrl === 'string' ? redisUrl.trim() : ''
  return trimmed ? 'On (Redis)' : 'On'
}

/** Baseline Next security headers are always on (env-driven; no Site Settings toggle). */
export function formatHeadersPosture(): string {
  return 'On'
}
