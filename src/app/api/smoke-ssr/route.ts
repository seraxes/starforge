import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * CI diagnostic — times the same awaits the public locale template uses.
 * Not linked from the UI. Safe to hit without a session.
 */
export async function GET() {
  const steps: Record<string, number> = {}
  const mark = async <T>(name: string, work: () => Promise<T>): Promise<T> => {
    const started = Date.now()
    try {
      return await work()
    } finally {
      steps[name] = Date.now() - started
    }
  }

  try {
    const { getSiteSettings } = await import('@/core/settings')
    const { getSiteChrome } = await import('@/core/site-chrome')
    const { getAccessViewer } = await import('@/core/acl/access')
    const { getActiveSkin } = await import('@/core/skin/resolve-active')
    const { getEnabledPublicLocales } = await import('@/core/i18n/enabled')
    const { ensureModulesRegistered } = await import('@/core/modules/boot')
    const { getPublicLayoutBundle } = await import('@/core/modules/layout')
    const { getPublishedPageBySlug } = await import('@/core/content/pages')
    const { requireContentLocale } = await import('@/core/content/pages')

    await mark('getSiteSettings', () => getSiteSettings())
    await mark('getSiteChrome', () => getSiteChrome())
    await mark('getAccessViewer', () => getAccessViewer())
    await mark('getActiveSkin', () => getActiveSkin())
    await mark('getEnabledPublicLocales', () => getEnabledPublicLocales())
    await mark('ensureModulesRegistered', () => ensureModulesRegistered())
    await mark('getPublicLayoutBundle', () => getPublicLayoutBundle())
    const locale = requireContentLocale('en')
    await mark('getPublishedPageBySlug(home)', () =>
      getPublishedPageBySlug('home', locale),
    )

    return NextResponse.json({ ok: true, steps })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, error: message, steps }, { status: 500 })
  }
}
