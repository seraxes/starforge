/**
 * Live HTTP check: authenticated GET /admin stays on Dashboard (not /admin/users).
 * Expects the app already running (CI smoke) at BETTER_AUTH_URL / NEXT_PUBLIC_APP_URL.
 * Run: npx tsx scripts/verify-admin-root-dashboard-http.mts
 */
import 'dotenv/config'

const base =
  process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000'
const email = process.env.STARFORGE_SMOKE_ADMIN_EMAIL || 'admin@starforge.local'
const password = process.env.STARFORGE_SMOKE_ADMIN_PASSWORD || 'starforge-admin'

function cookieJar(setCookies: string[]): string {
  return setCookies.map((c) => c.split(';')[0]).join('; ')
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
      const map = new Map<string, string>()
      for (const part of jar.split('; ').filter(Boolean)) {
        map.set(part.split('=')[0]!, part)
      }
      for (const part of next.split('; ').filter(Boolean)) {
        map.set(part.split('=')[0]!, part)
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
  console.log(
    'sign-in',
    signIn.status,
    'cookies',
    setCookies.map((c) => c.split('=')[0]).join(', '),
  )
  if (!cookie.includes('session_token')) {
    console.error('FAIL: no Better Auth session cookie')
    process.exit(1)
  }

  const admin = await fetchFollow(`${base}/admin`, cookie)
  const path = new URL(admin.finalUrl).pathname.replace(/\/$/, '') || '/'
  console.log(
    '  hops:',
    admin.hops.map((u) => new URL(u).pathname + new URL(u).search).join(' → '),
  )
  console.log('  final:', path, admin.status)

  if (path !== '/admin') {
    console.error(`FAIL: authenticated /admin must stay on /admin, got ${path}`)
    process.exit(1)
  }
  if (admin.hops.some((u) => new URL(u).pathname.includes('/admin/users'))) {
    console.error('FAIL: /admin must not hop through /admin/users', admin.hops)
    process.exit(1)
  }
  if (admin.status !== 200) {
    console.error(`FAIL: expected HTTP 200 for Dashboard, got ${admin.status}`)
    process.exit(1)
  }
  if (!admin.html.includes('Dashboard')) {
    console.error('FAIL: Dashboard page HTML missing “Dashboard”')
    console.error(admin.html.slice(0, 400))
    process.exit(1)
  }
  // Guard against accidentally rendering the Users accounts table as home.
  if (
    admin.html.includes('users-admin-table') ||
    (admin.html.includes('CMS access') && admin.html.includes('Disable'))
  ) {
    console.error('FAIL: /admin HTML looks like Users accounts, not Dashboard')
    process.exit(1)
  }

  console.log('PASS: authenticated /admin is Dashboard (Users is not the landing)')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
