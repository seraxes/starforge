import 'server-only'

import {
  ensureAtomsRegistered,
  getRegisteredAtom,
  listPageChromeOverrideKeys,
  loadGlobalPageChrome,
  loadPageChromeOverride,
  mergePageChrome,
} from '@/core/page-settings'
import { pageChromeCspSources } from '@/core/page-settings/csp'
import type { ResolvedPageChrome } from '@/core/page-settings'
import {
  MODULE_IDS,
  getSiteSettings,
  isAtomModuleEnabled,
  isCatalogModuleEnabled,
} from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'

import { CSP_TURNSTILE, mergeCspSources, type CspSources } from './csp'

async function resolveAllPageChromes(): Promise<ResolvedPageChrome[]> {
  const global = (await loadGlobalPageChrome()).chrome
  const chromes: ResolvedPageChrome[] = [mergePageChrome(global, null, null)]
  for (const pageKey of await listPageChromeOverrideKeys()) {
    const override = await loadPageChromeOverride(pageKey)
    if (override.isFallback) continue
    chromes.push(mergePageChrome(global, override.chrome, pageKey))
  }
  return chromes
}

/**
 * Site-wide feature-driven CSP sources (design-security §4): Turnstile when
 * it is the captcha provider; Font Awesome, analytics, and Page Settings
 * asset origins across the global chrome and every page override.
 * Each part fails soft to "no extra sources".
 */
export async function resolveFeatureCspSources(): Promise<CspSources> {
  const groups: CspSources[] = []

  try {
    const chrome = await getSiteChrome()
    if (chrome.captchaEnabled && chrome.captchaProvider === 'turnstile') {
      groups.push(CSP_TURNSTILE)
    }
  } catch {
    // Site Chrome store unavailable — no captcha sources.
  }

  try {
    const settings = await getSiteSettings()
    if (isCatalogModuleEnabled(settings, MODULE_IDS.pageSettings)) {
      await ensureAtomsRegistered()
      groups.push(
        pageChromeCspSources(await resolveAllPageChromes(), {
          fontAwesomeOn: isCatalogModuleEnabled(settings, MODULE_IDS.fontAwesome),
          isAtomEnabled: (type) => isAtomModuleEnabled(settings, type),
          getAtom: getRegisteredAtom,
        }),
      )
    }
  } catch {
    // Settings / page chrome unavailable — no Page Settings sources.
  }

  return mergeCspSources(...groups)
}
