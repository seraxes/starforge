/**
 * Prove /admin and /admin/login never serve Payload's email/password form
 * when a Better Auth session exists (with cms_access).
 *
 * Usage: npx tsx scripts/verify-admin-no-login-form.mts
 */
import 'dotenv/config'

const base = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const email = 'admin@starforge.local'
const password = 'starforge-admin'

function cookieJar(setCookies: string[]): string {
  return setCookies.map((c) => c.split(';')[0]).join('; ')
}

function hasPasswordForm(html: string): boolean {
  const lower = html.toLowerCase()
  return (
    (lower.includes('type="password"') || lower.includes("type='password'")) &&
    (lower.includes('name="email"') ||
      lower.includes("name='email'") ||
      lower.includes('type="email"') ||
      lower.includes('forgot password') ||
      lower.includes('log in'))
  )
}

async function fetchFollow(
  url: string,
  cookie: string,
  maxHops = 8,
): Promise<{ finalUrl: string; status: number; html: string; hops: string[] }> {
  const hops: string[] = []
  let current = url
  let jar = cookie

  for (let i = 0; i < maxHops; i++) {
    hops.push(current)
    const res = await fetch(current, {
      redirect: 'manual',
      headers: { cookie: jar, accept: 'text/html' },
    })
    const set = res.headers.getSetCookie?.() || []
    if (set.length) {
      const next = cookieJar(set)
      // merge by name
      const map = new Map<string, string>()
      for (const part of jar.split('; ').filter(Boolean)) {
        const n = part.split('=')[0]
        map.set(n, part)
      }
      for (const part of next.split('; ').filter(Boolean)) {
        const n = part.split('=')[0]
        map.set(n, part)
      }
      jar = [...map.values()].join('; ')
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      if (!loc) throw new Error(`redirect without location from ${current}`)
      current = new URL(loc, current).toString()
      continue
    }

    const html = await res.text()
    return { finalUrl: current, status: res.status, html, hops }
  }
  throw new Error(`too many redirects: ${hops.join(' → ')}`)
}

async function main() {
  console.log('Base', base)

  // 1) Sign in
  const signIn = await fetch(`${base}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: base,
      referer: `${base}/login`,
    },
    body: JSON.stringify({ email, password }),
  })
  const setCookies = signIn.headers.getSetCookie?.() || []
  const cookie = cookieJar(setCookies)
  console.log('sign-in', signIn.status, 'cookies', setCookies.map((c) => c.split('=')[0]).join(', '))
  if (!cookie.includes('session_token')) {
    console.error('FAIL: no Better Auth session cookie')
    process.exit(1)
  }

  // 2) /admin/login must never land on password form
  console.log('\nGET /admin/login …')
  const login = await fetchFollow(`${base}/admin/login`, cookie)
  console.log('  hops:', login.hops.map((u) => new URL(u).pathname + new URL(u).search).join(' → '))
  console.log('  final:', new URL(login.finalUrl).pathname + new URL(login.finalUrl).search, login.status)
  if (login.finalUrl.includes('/admin/login')) {
    console.error('FAIL: still on /admin/login')
    process.exit(1)
  }
  if (hasPasswordForm(login.html)) {
    console.error('FAIL: password form in HTML after /admin/login')
    console.error(login.html.slice(0, 500))
    process.exit(1)
  }
  console.log('  OK: no password form')

  // 3) Fresh jar (BA only) → /admin
  console.log('\nGET /admin (BA only, no payload-token)…')
  const admin = await fetchFollow(`${base}/admin`, cookie)
  console.log('  hops:', admin.hops.map((u) => new URL(u).pathname + new URL(u).search).join(' → '))
  console.log('  final:', new URL(admin.finalUrl).pathname + new URL(admin.finalUrl).search, admin.status)
  if (admin.finalUrl.includes('/admin/login')) {
    console.error('FAIL: /admin ended on /admin/login')
    process.exit(1)
  }
  if (hasPasswordForm(admin.html)) {
    console.error('FAIL: password form in HTML after /admin')
    process.exit(1)
  }
  // Should be authenticated admin UI
  const looksAdmin =
    admin.html.includes('Dashboard') ||
    admin.html.includes('collections') ||
    admin.html.includes('payload') ||
    admin.html.includes('Starforge')
  console.log('  looksAdmin-ish', looksAdmin, 'htmlLen', admin.html.length)
  console.log('  OK: no password form')

  // 4) Unauthenticated /admin/login → core login
  console.log('\nGET /admin/login (no cookies)…')
  const bare = await fetch(`${base}/admin/login`, { redirect: 'manual' })
  const loc = bare.headers.get('location') || ''
  console.log('  status', bare.status, 'location', loc)
  if (!(bare.status >= 300 && bare.status < 400 && loc.includes('/login'))) {
    console.error('FAIL: unauthenticated /admin/login should redirect to /login')
    process.exit(1)
  }
  console.log('  OK')

  console.log('\nPASS: /admin and /admin/login never show Payload password form')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
