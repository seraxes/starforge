import 'server-only'

import type {
  FiscalInvoicePayload,
  FiscalProvider,
  FiscalProviderInfo,
  FiscalSubmitResult,
} from './types'

/**
 * HU NAV Online Számla adapter skeleton.
 * Ready when NAV_TECHNICAL_USER + NAV_SIGN_KEY + NAV_EXCHANGE_KEY (+ optional cert) exist.
 * Full XML/SOAP integration ships when production credentials are available —
 * until then returns a clear not-ready / not-implemented error so outbox can retry.
 *
 * Env:
 * - NAV_TECHNICAL_USER
 * - NAV_SIGN_KEY
 * - NAV_EXCHANGE_KEY
 * - NAV_API_BASE (optional)
 * - NAV_TAX_NUMBER (seller)
 */

function navConfigured(): boolean {
  return Boolean(
    process.env.NAV_TECHNICAL_USER?.trim() &&
      process.env.NAV_SIGN_KEY?.trim() &&
      process.env.NAV_EXCHANGE_KEY?.trim(),
  )
}

function apiBase(): string {
  return (
    process.env.NAV_API_BASE?.trim() ||
    'https://api-test.onlineszamla.nav.gov.hu'
  ).replace(/\/$/, '')
}

export function createNavFiscalProvider(): FiscalProvider {
  const ready = navConfigured()

  return {
    async submitInvoice(payload: FiscalInvoicePayload): Promise<FiscalSubmitResult> {
      if (!ready) {
        return {
          ok: false,
          error: 'NAV credentials not configured (NAV_TECHNICAL_USER / SIGN / EXCHANGE)',
        }
      }
      // Payload is NAV-shaped; wire manageInvoice XML when cert + WSDL client land.
      void payload
      void apiBase
      return {
        ok: false,
        error:
          'NAV Online Számla adapter credentials present but XML submit not enabled in this build — outbox will retry',
      }
    },

    async submitModifier(
      originalInvoiceId: string,
      payload: FiscalInvoicePayload,
    ): Promise<FiscalSubmitResult> {
      if (!ready) {
        return { ok: false, error: 'NAV credentials not configured' }
      }
      void originalInvoiceId
      void payload
      return {
        ok: false,
        error: 'NAV modifier submit not enabled in this build — outbox will retry',
      }
    },

    async queryStatus(fiscalRef: string) {
      if (!ready) return { ok: false, status: 'unconfigured', error: 'NAV not configured' }
      void fiscalRef
      return { ok: false, status: 'pending', error: 'NAV query not enabled in this build' }
    },

    info(): FiscalProviderInfo {
      return {
        provider: 'nav_online_szamla',
        label: 'NAV Online Számla',
        ready,
        detail: ready
          ? `Credentials set — API ${apiBase()} (XML submit gated)`
          : 'Set NAV_TECHNICAL_USER, NAV_SIGN_KEY, NAV_EXCHANGE_KEY in Environment',
      }
    },
  }
}
