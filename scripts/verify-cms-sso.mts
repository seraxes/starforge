/**
 * Prove one-login: Better Auth session → Payload strategy returns a user.
 * Usage: npx tsx scripts/verify-cms-sso.mts
 */
import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config.ts'
import { auth } from '../src/core/auth/index.ts'
import { starforgeCoreSessionStrategy } from '../src/core/cms-bridge/payload-strategy.ts'
import { loadCoreUserCmsAccess, findPayloadCmsUserByEmail } from '../src/core/cms-bridge/index.ts'

const email = 'admin@starforge.local'
const password = 'starforge-admin'

async function main() {
  console.log('1) Sign in via Better Auth API…')
  const signIn = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
  })
  const setCookies = signIn.headers.getSetCookie?.() || []
  console.log('   status', signIn.status)
  console.log(
    '   set-cookie names:',
    setCookies.map((c) => c.split('=')[0]).join(', ') || '(none)',
  )

  const cookieHeader = setCookies.map((c) => c.split(';')[0]).join('; ')
  if (!cookieHeader.includes('session_token')) {
    console.error('FAIL: no session_token cookie after sign-in')
    process.exit(1)
  }

  const headers = new Headers({ cookie: cookieHeader })

  console.log('2) Better Auth getSession(disableRefresh)…')
  const session = await auth.api.getSession({
    headers,
    query: { disableRefresh: true },
  })
  console.log('   session user', session?.user?.email, session?.user?.id)
  if (!session?.user?.id) {
    console.error('FAIL: getSession returned null')
    process.exit(1)
  }

  console.log('3) cms_access + Payload stub…')
  const access = await loadCoreUserCmsAccess(session.user.id)
  console.log('   access', access)
  const stub = await findPayloadCmsUserByEmail(email)
  console.log('   stub', stub ? { id: stub.id, email: stub.email, coreUserId: stub.coreUserId } : null)
  if (!access?.cmsAccess || !stub) {
    console.error('FAIL: missing cms_access or Payload stub')
    process.exit(1)
  }

  console.log('4) Payload strategy authenticate…')
  const payload = await getPayload({ config })
  const result = await starforgeCoreSessionStrategy.authenticate({
    headers,
    payload,
    canSetHeaders: false,
    isGraphQL: false,
  })
  console.log(
    '   strategy user',
    result.user
      ? { id: result.user.id, email: (result.user as { email?: string }).email, collection: result.user.collection, strategy: (result.user as { _strategy?: string })._strategy }
      : null,
  )

  if (!result.user) {
    console.error('FAIL: strategy returned null user')
    process.exit(1)
  }

  console.log('5) payload.auth({ headers })…')
  const authResult = await payload.auth({ headers, canSetHeaders: false })
  console.log(
    '   payload.auth user',
    authResult.user
      ? { id: authResult.user.id, email: authResult.user.email, collection: authResult.user.collection }
      : null,
  )
  if (!authResult.user) {
    console.error('FAIL: payload.auth returned null')
    process.exit(1)
  }

  console.log('\nOK: seeded admin Better Auth session authenticates Payload strategy.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
