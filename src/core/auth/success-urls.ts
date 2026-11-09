import 'server-only'

import { safeNextPath } from './safe-next-path'
import {
  DEFAULT_AUTH_POST_LOGIN_URL,
  DEFAULT_AUTH_POST_LOGOUT_URL,
  DEFAULT_AUTH_POST_REGISTER_URL,
  getSiteChrome,
  isOfflineAllowedPath,
} from '@/core/site-chrome'

/**
 * Resolve post-login redirect: form/query `next` wins when safe, else Chrome default.
 */
export async function resolvePostLoginUrl(nextValue?: unknown): Promise<string> {
  const chrome = await getSiteChrome()
  const fallback = safeNextPath(chrome.authPostLoginUrl, DEFAULT_AUTH_POST_LOGIN_URL)
  return safeNextPath(nextValue, fallback)
}

/** Resolve post-register redirect from Site Settings → Auth. */
export async function resolvePostRegisterUrl(): Promise<string> {
  const chrome = await getSiteChrome()
  return safeNextPath(chrome.authPostRegisterUrl, DEFAULT_AUTH_POST_REGISTER_URL)
}

/**
 * Resolve post-logout redirect. When the site is offline and the configured
 * target is gated, fall back to `/login` (offline-allowed).
 */
export async function resolvePostLogoutUrl(): Promise<string> {
  const chrome = await getSiteChrome()
  const configured = safeNextPath(chrome.authPostLogoutUrl, DEFAULT_AUTH_POST_LOGOUT_URL)
  if (chrome.offlineEnabled && !isOfflineAllowedPath(configured)) {
    return DEFAULT_AUTH_POST_LOGOUT_URL
  }
  return configured
}
