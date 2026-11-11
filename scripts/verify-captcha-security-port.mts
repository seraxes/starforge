/**
 * Smoke checks for the Core security captcha port.
 * Run: npx tsx scripts/verify-captcha-security-port.mts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  CAPTCHA_PROVIDERS,
  isWiredCaptchaProvider,
} from '../src/core/security/captcha/providers.ts'
import { resolveFromProvider } from '../src/core/security/captcha/policy.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8')
}

assert.deepEqual(
  CAPTCHA_PROVIDERS.map((p) => p.value),
  ['none', 'turnstile'],
)
assert.equal(isWiredCaptchaProvider('hcaptcha'), false)
console.log('wired providers catalog: ok')

const stub = resolveFromProvider('recaptcha', true)
assert.equal(stub.required, true)
assert.equal(stub.siteKey, null)
console.log('fail-closed stub resolve: ok')

const formsCaptcha = read('src/modules/forms/captcha.ts')
assert.match(formsCaptcha, /@\/core\/security\/captcha/)
assert.doesNotMatch(formsCaptcha, /challenges\.cloudflare\.com/)
console.log('forms/captcha is thin re-export: ok')

const securityIndex = read('src/core/security/index.ts')
assert.match(securityIndex, /resolveFormCaptcha/)
assert.match(securityIndex, /verifyCaptchaToken/)
console.log('security barrel exports captcha port: ok')

const settingsForm = read(
  'src/app/(frontend)/admin/settings/security/security-settings-form.tsx',
)
assert.match(settingsForm, /captchaOnRegister/)
assert.match(settingsForm, /captchaOnAuthRecovery/)
assert.doesNotMatch(settingsForm, /value=\"recaptcha\"/)
assert.doesNotMatch(settingsForm, /value=\"hcaptcha\"/)
assert.match(settingsForm, /CAPTCHA_PROVIDERS/)
console.log('Security settings surfaces + wired-only provider select: ok')

const authActions = read('src/core/auth/actions.ts')
assert.match(authActions, /enforceCaptchaFromFormData/)
assert.match(authActions, /'register'/)
assert.match(authActions, /'auth-recovery'/)
console.log('auth actions enforce captcha surfaces: ok')

console.log('verify-captcha-security-port: all ok')
