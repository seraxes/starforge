/**
 * Smoke check: consent preference cookie parse/serialize (SF-131).
 * Run: npm run verify:consent-cookie
 */
import {
  CONSENT_COOKIE_NAME,
  buildConsentPreferences,
  hasAnalyticsConsent,
  parseConsentPreferences,
  readConsentFromCookieHeader,
  serializeConsentPreferences,
} from '../src/core/consent/index.ts'

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) {
    console.error(message)
    process.exit(1)
  }
}

assert(CONSENT_COOKIE_NAME === 'sf-consent', 'cookie name')

const accepted = buildConsentPreferences({ analytics: true })
assert(accepted.necessary === true, 'necessary always on')
assert(accepted.analytics === true, 'analytics accept')
assert(hasAnalyticsConsent(accepted), 'hasAnalyticsConsent true')

const essential = buildConsentPreferences({ analytics: false })
assert(essential.analytics === false, 'analytics reject')
assert(!hasAnalyticsConsent(essential), 'hasAnalyticsConsent false')
assert(!hasAnalyticsConsent(null), 'null prefs')

const roundTrip = parseConsentPreferences(
  JSON.parse(serializeConsentPreferences(accepted)) as unknown,
)
assert(roundTrip?.analytics === true, 'round-trip analytics')
assert(roundTrip?.v === 1, 'round-trip version')

assert(parseConsentPreferences({ analytics: 'yes' }) === null, 'reject non-bool analytics')
assert(parseConsentPreferences({}) === null, 'reject missing analytics')
assert(parseConsentPreferences(null) === null, 'reject null')

const encoded = encodeURIComponent(serializeConsentPreferences(essential))
const header = `a=1; ${CONSENT_COOKIE_NAME}=${encoded}; b=2`
const fromHeader = readConsentFromCookieHeader(header)
assert(fromHeader?.analytics === false, 'read from Cookie header')
assert(readConsentFromCookieHeader('x=1') === null, 'missing cookie')
assert(readConsentFromCookieHeader(`${CONSENT_COOKIE_NAME}=%7Bnot-json`) === null, 'bad json')

console.log('verify-consent-cookie: pass')
