'use server'

import { revalidatePath } from 'next/cache'

import { requireAppAdmin } from '@/core/auth/admin'
import { invalidateSiteChrome, invalidateSiteSettings } from '@/core/content/revalidate'
import {
  MODULE_IDS,
  clampAdminAutosaveDebounceMs,
  clampDashboardOnlineWindowMin,
  clampDashboardRefreshIntervalSec,
  clampFormRateLimitMax,
  clampFormRateLimitWindowSec,
  clampNullMissTtlSec,
  clampPublishedCacheTtlSec,
  coercePublishedCacheEnabled,
  featureFlagsFromModuleToggles,
  getSiteSettings,
  listInstalledModuleCatalog,
  type ModuleToggleMap,
  type SiteSettingsData,
  updateSiteSettings,
} from '@/core/settings'
import { saveSiteChrome } from '@/core/site-chrome/store'

/** Preserve Performance knobs when another Settings topic saves. */
function performanceFieldsFrom(current: SiteSettingsData) {
  return {
    formRateLimitMax: current.formRateLimitMax,
    formRateLimitWindowSec: current.formRateLimitWindowSec,
    publishedCacheEnabled: current.publishedCacheEnabled,
    publishedCacheTtlSec: current.publishedCacheTtlSec,
    nullMissTtlSec: current.nullMissTtlSec,
    dashboardRefreshIntervalSec: current.dashboardRefreshIntervalSec,
    dashboardOnlineWindowMin: current.dashboardOnlineWindowMin,
  }
}

export type SettingsActionState = {
  error?: string
  ok?: boolean
}

function parseBool(formData: FormData, key: string): boolean {
  const raw = formData.get(key)
  return raw === 'on' || raw === 'true' || raw === '1'
}

/**
 * Read Site Settings → Modules toggles; required ids forced on.
 * Empty module fieldset → preserve `current` (never wipe every pack to false).
 */
function parseModuleToggles(
  formData: FormData,
  current: ModuleToggleMap,
): ModuleToggleMap {
  const catalog = listInstalledModuleCatalog()
  const ids = formData.getAll('moduleToggleId').map((v) => String(v ?? '').trim()).filter(Boolean)
  const enabledRaw = new Set(
    formData.getAll('moduleToggleEnabled').map((v) => String(v ?? '').trim()).filter(Boolean),
  )

  // No module rows in this submit — keep stored toggles (avoid all-false wipe).
  if (ids.length === 0) {
    return { ...current }
  }

  const map: ModuleToggleMap = { ...current }
  for (const item of catalog) {
    if (item.required) {
      map[item.id] = true
      continue
    }
    if (!ids.includes(item.id)) continue
    map[item.id] = enabledRaw.has(item.id)
  }
  return map
}

async function revalidateSettingsPaths() {
  await invalidateSiteSettings()
  revalidatePath('/', 'layout')
  revalidatePath('/register')
  revalidatePath('/login')
  revalidatePath('/admin/settings')
  revalidatePath('/admin/settings/admin-ux')
  revalidatePath('/admin/settings/auth')
  revalidatePath('/admin/settings/security')
  revalidatePath('/admin/settings/performance')
  revalidatePath('/admin/nav')
  revalidatePath('/admin/forms')
  revalidatePath('/admin/email')
  revalidatePath('/admin/email/templates')
  revalidatePath('/admin/layouts')
  revalidatePath('/admin/outlines')
  revalidatePath('/admin/page-settings')
  revalidatePath('/admin')
}

/**
 * Site Settings → Modules: module on/off + primary nav assignment.
 * Preserves Admin UX debounce from the current global.
 */
export async function updateSiteSettingsAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const admin = await requireAppAdmin()
  if (!admin) {
    return { error: 'Sign in as a Starforge app admin to edit site settings.' }
  }

  const current = await getSiteSettings()
  const siteName = String(formData.get('siteName') ?? '').trim() || current.siteName
  const primaryNavMenuId =
    String(formData.get('primaryNavMenuId') ?? '').trim() || current.primaryNavMenuId
  const catalog = listInstalledModuleCatalog()
  const moduleToggles = parseModuleToggles(formData, current.moduleToggles)
  const features = featureFlagsFromModuleToggles(moduleToggles, catalog)

  try {
    await updateSiteSettings({
      siteName,
      primaryNavMenuId,
      adminAutosaveDebounceMs: current.adminAutosaveDebounceMs,
      ...performanceFieldsFrom(current),
      keepLegacyPrimaryNav: true,
      features,
      moduleToggles,
    })
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Could not save site settings.'
    return { error: message }
  }

  await revalidateSettingsPaths()
  return { ok: true }
}

/** Site Settings → Admin UX: autosave debounce only. */
export async function updateAdminUxSettingsAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const admin = await requireAppAdmin()
  if (!admin) {
    return { error: 'Sign in as a Starforge app admin to edit Admin UX settings.' }
  }

  const current = await getSiteSettings()
  const adminAutosaveDebounceMs = clampAdminAutosaveDebounceMs(
    formData.get('adminAutosaveDebounceMs'),
  )

  try {
    await updateSiteSettings({
      siteName: current.siteName,
      primaryNavMenuId: current.primaryNavMenuId,
      adminAutosaveDebounceMs,
      ...performanceFieldsFrom(current),
      keepLegacyPrimaryNav: true,
      features: current.features,
      moduleToggles: current.moduleToggles,
    })
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Could not save Admin UX settings.'
    return { error: message }
  }

  await revalidateSettingsPaths()
  return { ok: true }
}

/** Site Settings → Performance: Form rate-limit + published-cache knobs (non-secret). */
export async function updatePerformanceSettingsAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const admin = await requireAppAdmin()
  if (!admin) {
    return { error: 'Sign in as a Starforge app admin to edit Performance settings.' }
  }

  const current = await getSiteSettings()
  const formRateLimitMax = clampFormRateLimitMax(formData.get('formRateLimitMax'))
  const formRateLimitWindowSec = clampFormRateLimitWindowSec(
    formData.get('formRateLimitWindowSec'),
  )
  const publishedCacheEnabled = coercePublishedCacheEnabled(
    formData.get('publishedCacheEnabled') ?? false,
  )
  const publishedCacheTtlSec = clampPublishedCacheTtlSec(
    formData.get('publishedCacheTtlSec'),
  )
  const nullMissTtlSec = clampNullMissTtlSec(formData.get('nullMissTtlSec'))
  const dashboardRefreshIntervalSec = clampDashboardRefreshIntervalSec(
    formData.get('dashboardRefreshIntervalSec'),
  )
  const dashboardOnlineWindowMin = clampDashboardOnlineWindowMin(
    formData.get('dashboardOnlineWindowMin'),
  )

  try {
    await updateSiteSettings({
      siteName: current.siteName,
      primaryNavMenuId: current.primaryNavMenuId,
      adminAutosaveDebounceMs: current.adminAutosaveDebounceMs,
      formRateLimitMax,
      formRateLimitWindowSec,
      publishedCacheEnabled,
      publishedCacheTtlSec,
      nullMissTtlSec,
      dashboardRefreshIntervalSec,
      dashboardOnlineWindowMin,
      keepLegacyPrimaryNav: true,
      features: current.features,
      moduleToggles: current.moduleToggles,
    })
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Could not save Performance settings.'
    return { error: message }
  }

  await revalidateSettingsPaths()
  return { ok: true }
}

/**
 * Site Settings → Auth & registration: registration enable + public auth option toggles.
 * Registration writes the same `product:registration` module toggle + feature flag as Modules.
 * Auth option surfaces (forgot / magic / OTP / remember / 2FA) live on Site Chrome JSON
 * (no Payload migration) — same storage pattern as Security captcha.
 */
export async function updateAuthSettingsAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const admin = await requireAppAdmin()
  if (!admin) {
    return { error: 'Sign in as a Starforge app admin to edit auth settings.' }
  }

  const current = await getSiteSettings()
  const registrationOn = parseBool(formData, 'registrationEnabled')
  const moduleToggles: ModuleToggleMap = {
    ...current.moduleToggles,
    [MODULE_IDS.registration]: registrationOn,
  }
  // Preserve other feature flags — only flip registration (also mirrored on the module row).
  const features = {
    ...current.features,
    registration: registrationOn,
  }

  try {
    await updateSiteSettings({
      siteName: current.siteName,
      primaryNavMenuId: current.primaryNavMenuId,
      adminAutosaveDebounceMs: current.adminAutosaveDebounceMs,
      ...performanceFieldsFrom(current),
      keepLegacyPrimaryNav: true,
      features,
      moduleToggles,
    })
    await saveSiteChrome({
      authForgotPasswordEnabled: parseBool(formData, 'authForgotPasswordEnabled'),
      authForgotUsernameEnabled: parseBool(formData, 'authForgotUsernameEnabled'),
      authMagicLinkEnabled: parseBool(formData, 'authMagicLinkEnabled'),
      authEmailOtpEnabled: parseBool(formData, 'authEmailOtpEnabled'),
      authRememberMeEnabled: parseBool(formData, 'authRememberMeEnabled'),
      authTwoFactorEnabled: parseBool(formData, 'authTwoFactorEnabled'),
    })
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Could not save auth settings.'
    return { error: message }
  }

  await invalidateSiteChrome()
  await revalidateSettingsPaths()
  revalidatePath('/login')
  revalidatePath('/forgot-password')
  revalidatePath('/forgot-username')
  revalidatePath('/account/security')
  revalidatePath('/admin/settings/auth')
  return { ok: true }
}
