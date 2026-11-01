/**
 * Local demo seed for Starforge.
 *
 * Creates sample **published** CMS pages (Payload), site settings, core app
 * users (Better Auth), and grants **cms_access** (+ Payload stub) for the
 * bootstrap global admin. One Better Auth login opens `/admin` — no second
 * password. Product members stay in core unless CMS access is toggled on.
 *
 * Usage (Compose up, `.env` present, core tables pushed):
 *   npm run seed
 *
 * Idempotent: skips pages / users that already exist.
 */
import 'dotenv/config'

import { getPayload } from 'payload'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

import config from '@payload-config'
import { ensureDefaultUserGroupsSeeded } from './core/acl'
import { auth } from './core/auth'
import {
  getBootstrapAdminEmails,
  promoteBootstrapAdminsByEmail,
  setUserRole,
} from './core/auth/admin'
import { BOOTSTRAP_ADMIN_EMAIL, setCoreUserCmsAccess } from './core/cms-bridge'
import { db } from './core/db'
import { sfUsers } from './core/db/schema'
import { ensureDefaultLayoutSeeded } from './core/modules'
import { ensureGlobalPageChromeSeeded } from './core/page-settings'
import { ensureSiteChromeSeeded } from './core/site-chrome'
import {
  ensureSiteSettingsDefaults,
  getSiteSettings,
  seedPrimaryNavFromPages,
} from './core/settings'
import { eq } from 'drizzle-orm'

const DEMO_APP_EMAIL = 'demo@starforge.local'
const DEMO_APP_PASSWORD = 'starforge-demo'
const DEMO_APP_NAME = 'Demo Member'

/** Local bootstrap admin — same email/password for core `/login` and Payload `/admin`. */
const BOOTSTRAP_ADMIN_PASSWORD = 'starforge-admin'
const BOOTSTRAP_ADMIN_NAME = 'Demo Admin'

type TextChild = {
  type: string
  version: number
  [key: string]: unknown
}

function textNode(text: string, format = 0): TextChild {
  return {
    type: 'text',
    detail: 0,
    format,
    mode: 'normal',
    style: '',
    text,
    version: 1,
  }
}

function paragraph(...children: TextChild[]): TextChild {
  return {
    type: 'paragraph',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    textFormat: 0,
    children,
  }
}

function heading(tag: 'h2' | 'h3', text: string): TextChild {
  return {
    type: 'heading',
    tag,
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: [textNode(text)],
  }
}

function listItem(text: string): TextChild {
  return {
    type: 'listitem',
    value: 1,
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: [textNode(text)],
  }
}

function bulletList(...items: string[]): TextChild {
  return {
    type: 'list',
    listType: 'bullet',
    start: 1,
    tag: 'ul',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: items.map((item) => listItem(item)),
  }
}

function lexicalBody(...blocks: TextChild[]): SerializedEditorState {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr',
      children: blocks,
    },
  } as SerializedEditorState
}

const SAMPLE_PAGES = [
  {
    title: 'About',
    slug: 'about',
    meta: {
      title: 'About Starforge',
      description: 'What Starforge is: a reusable product core with Payload as the content module.',
    },
    body: lexicalBody(
      heading('h2', 'A reusable core, not a CMS lock-in'),
      paragraph(
        textNode(
          'Starforge owns product auth, app users, and APIs. Payload CMS handles editorial pages and media only.',
        ),
      ),
      bulletList(
        'Core app accounts: /register and /login',
        'CMS: Payload /admin via the same Better Auth login (cms_access)',
        'Published pages render at /{slug}',
      ),
    ),
  },
  {
    title: 'Getting started',
    slug: 'getting-started',
    meta: {
      title: 'Getting started with Starforge',
      description: 'Local Compose, seed, edit in /admin, and open a published page by slug.',
    },
    body: lexicalBody(
      heading('h2', 'Local loop'),
      paragraph(textNode('With Postgres running and npm run dev:')),
      bulletList(
        'npm run seed — sample published pages (+ optional demo app user)',
        'Open /about and /getting-started on the public site',
        'Edit pages in /admin after one core login (no second password)',
        'Register an app account at /register if you did not use the demo user',
      ),
      heading('h3', 'Two kinds of users'),
      paragraph(
        textNode(
          'Core /login owns every session. Payload /admin opens for users with cms_access (admins by default). Ordinary members are never synced into Payload.',
        ),
      ),
    ),
  },
  {
    title: 'Welcome',
    slug: 'welcome',
    meta: {
      title: 'Welcome — Starforge sample page',
      description: 'A third sample published page from npm run seed, with SEO meta fields filled in.',
    },
    body: lexicalBody(
      heading('h2', 'Seeded sample'),
      paragraph(
        textNode(
          'This page was created by npm run seed. Open the SEO tab in Payload admin to change meta title, description, and OG image.',
        ),
      ),
      paragraph(
        textNode('Pastel brand colors, Better Auth sessions, and Lexical editing should still work after seeding.'),
      ),
    ),
  },
] as const

async function seedPages() {
  const payload = await getPayload({ config })
  const created: string[] = []
  const skipped: string[] = []

  for (const sample of SAMPLE_PAGES) {
    const existing = await payload.find({
      collection: 'pages',
      where: { slug: { equals: sample.slug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (existing.docs.length > 0) {
      skipped.push(sample.slug)
      continue
    }

    await payload.create({
      collection: 'pages',
      data: {
        title: sample.title,
        slug: sample.slug,
        // Lexical JSON — Payload Page type is generated with a wider index signature.
        body: sample.body as never,
        meta: sample.meta,
        _status: 'published',
      },
      draft: false,
      overrideAccess: true,
    })
    created.push(sample.slug)
  }

  return { created, skipped }
}

async function seedDemoAppUser() {
  const [existing] = await db
    .select({ id: sfUsers.id, email: sfUsers.email })
    .from(sfUsers)
    .where(eq(sfUsers.email, DEMO_APP_EMAIL))
    .limit(1)

  if (existing) {
    return { created: false as const, email: DEMO_APP_EMAIL }
  }

  await auth.api.signUpEmail({
    body: {
      name: DEMO_APP_NAME,
      email: DEMO_APP_EMAIL,
      password: DEMO_APP_PASSWORD,
    },
  })

  return { created: true as const, email: DEMO_APP_EMAIL }
}

async function seedBootstrapAdmin() {
  const [existing] = await db
    .select({ id: sfUsers.id, email: sfUsers.email, role: sfUsers.role })
    .from(sfUsers)
    .where(eq(sfUsers.email, BOOTSTRAP_ADMIN_EMAIL))
    .limit(1)

  if (existing) {
    if (existing.role !== 'admin') {
      await setUserRole(existing.id, 'admin')
    } else {
      await setCoreUserCmsAccess(existing.id, true)
    }
    return { created: false as const, email: BOOTSTRAP_ADMIN_EMAIL, id: existing.id }
  }

  const result = await auth.api.signUpEmail({
    body: {
      name: BOOTSTRAP_ADMIN_NAME,
      email: BOOTSTRAP_ADMIN_EMAIL,
      password: BOOTSTRAP_ADMIN_PASSWORD,
    },
  })

  const userId = result.user?.id
  if (userId) {
    await setUserRole(userId, 'admin')
  }

  return { created: true as const, email: BOOTSTRAP_ADMIN_EMAIL, id: userId ?? null }
}

/**
 * Turn on the Modules capability so the seeded notice-bar module is visible
 * in the header position after a fresh seed. Idempotent. Partial Payload
 * update preserves existing primary-nav page relationships.
 */
async function seedEnableModulesDemo() {
  const settings = await getSiteSettings()
  const noticeOn = settings.moduleToggles['notice-bar'] === true
  if (settings.features.modules && noticeOn) {
    return { updated: false as const, modules: true as const }
  }

  const payload = await getPayload({ config })
  const otherToggles = Object.entries(settings.moduleToggles)
    .filter(([id]) => id !== 'notice-bar')
    .map(([moduleId, enabled]) => ({ moduleId, enabled }))

  await payload.updateGlobal({
    slug: 'site-settings',
    // Cast until Payload types are regenerated for `moduleToggles`.
    data: {
      featureModules: true,
      moduleToggles: [{ moduleId: 'notice-bar', enabled: true }, ...otherToggles],
    } as Record<string, unknown>,
    overrideAccess: true,
  })

  return { updated: true as const, modules: true as const }
}

async function seedCmsAccessForAdmins() {
  const admins = await db
    .select({ id: sfUsers.id, email: sfUsers.email, role: sfUsers.role })
    .from(sfUsers)

  const envEmails = new Set(getBootstrapAdminEmails().map((e) => e.toLowerCase()))
  const targets = admins.filter(
    (row) => row.role === 'admin' || envEmails.has(row.email.toLowerCase()),
  )

  const enabled: string[] = []
  const failed: { email: string; error: string }[] = []

  for (const row of targets) {
    const result = await setCoreUserCmsAccess(row.id, true)
    if (result.ok) enabled.push(row.email)
    else failed.push({ email: row.email, error: result.error })
  }

  return { enabled, failed }
}

async function main() {
  // Lets Better Auth create bootstrap users even if registration toggle is off.
  process.env.STARFORGE_SEEDING = '1'

  console.log('')
  console.log('Starforge seed')
  console.log('--------------')
  console.log('One login: Better Auth at /login. CMS access opens /admin with no second password.')
  console.log('Toggle CMS access under /app/admin/users (admins get it by default).')
  console.log('')

  try {
    const settings = await ensureSiteSettingsDefaults()
    console.log(
      `Site settings: "${settings.siteName}" · nav ${settings.primaryNav.length} · registration=${settings.features.registration}`,
    )
  } catch (error) {
    console.warn('Could not seed site settings (Payload global).')
    console.warn(error instanceof Error ? error.message : error)
  }

  try {
    const modulesDemo = await seedEnableModulesDemo()
    console.log(
      modulesDemo.updated
        ? 'Modules feature: enabled (notice bar → header position)'
        : 'Modules feature: already on',
    )
  } catch (error) {
    console.warn('Could not enable Modules feature for the notice-bar demo.')
    console.warn(error instanceof Error ? error.message : error)
  }

  try {
    const layoutSeed = await ensureDefaultLayoutSeeded()
    if (layoutSeed.created) {
      console.log(
        'Layout document: seeded v3 default (notice-bar, site-header, page-content, custom) into sf_layouts',
      )
    } else if (layoutSeed.upgraded) {
      console.log('Layout document: upgraded existing sf_layouts row to v3 (sections → rows → slots)')
    } else {
      console.log('Layout document: sf_layouts.default already present (v3)')
    }
  } catch (error) {
    console.warn('Could not seed layout document (sf_layouts).')
    console.warn('Run: npm run db:core:push')
    console.warn(error instanceof Error ? error.message : error)
  }

  try {
    const chromeSeed = await ensureGlobalPageChromeSeeded()
    console.log(
      chromeSeed.created
        ? 'Page Settings: seeded global chrome defaults into sf_page_chrome'
        : 'Page Settings: sf_page_chrome.global already present',
    )
  } catch (error) {
    console.warn('Could not seed Page Settings (sf_page_chrome).')
    console.warn('Run: npm run db:core:push')
    console.warn(error instanceof Error ? error.message : error)
  }

  try {
    const siteChromeSeed = await ensureSiteChromeSeeded()
    console.log(
      siteChromeSeed.created
        ? `Site Chrome: seeded defaults into sf_site_chrome ("${siteChromeSeed.chrome.siteName}")`
        : `Site Chrome: sf_site_chrome.global already present ("${siteChromeSeed.chrome.siteName}")`,
    )
  } catch (error) {
    console.warn('Could not seed Site Chrome (sf_site_chrome).')
    console.warn('Run: npm run db:core:push')
    console.warn(error instanceof Error ? error.message : error)
  }

  const pages = await seedPages()
  if (pages.created.length) {
    console.log(`Pages created (published): ${pages.created.map((s) => `/${s}`).join(', ')}`)
  }
  if (pages.skipped.length) {
    console.log(`Pages skipped (already exist): ${pages.skipped.map((s) => `/${s}`).join(', ')}`)
  }

  try {
    const nav = await seedPrimaryNavFromPages([
      { label: 'About', slug: 'about' },
      { label: 'Getting started', slug: 'getting-started' },
      { label: 'Welcome', slug: 'welcome' },
    ])
    if (nav.updated) {
      console.log(
        `Nav manager Main menu → CMS pages: ${nav.primaryNav.map((i) => `${i.label} (${i.href})`).join(', ')}`,
      )
    } else {
      console.log(
        `Nav manager Main unchanged (${nav.primaryNav.length} items): ${nav.primaryNav.map((i) => i.href).join(', ')}`,
      )
    }
  } catch (error) {
    console.warn('Could not seed Nav manager Main menu (sf_nav_menus).')
    console.warn('Run: npm run db:core:push')
    console.warn(error instanceof Error ? error.message : error)
  }

  try {
    const groups = await ensureDefaultUserGroupsSeeded()
    if (groups.created.length) {
      console.log(`User groups created: ${groups.created.join(', ')}`)
    } else {
      console.log('User groups: already present (or skipped)')
    }
  } catch (error) {
    console.warn('Could not seed user groups (sf_user_groups).')
    console.warn('Run: npm run db:core:push')
    console.warn(error instanceof Error ? error.message : error)
  }

  try {
    const adminUser = await seedBootstrapAdmin()
    if (adminUser.created) {
      console.log('')
      console.log(`Bootstrap app admin created (core /app/admin):`)
      console.log(`  email:    ${BOOTSTRAP_ADMIN_EMAIL}`)
      console.log(`  password: ${BOOTSTRAP_ADMIN_PASSWORD}`)
      console.log(`  role:     admin (+ cms_access)`)
    } else {
      console.log(`Bootstrap app admin already exists: ${adminUser.email}`)
    }

    const appUser = await seedDemoAppUser()
    if (appUser.created) {
      console.log('')
      console.log(`Demo app member created (core /login — not CMS):`)
      console.log(`  email:    ${DEMO_APP_EMAIL}`)
      console.log(`  password: ${DEMO_APP_PASSWORD}`)
      console.log(`  role:     member`)
    } else {
      console.log(`Demo app member already exists: ${appUser.email}`)
    }

    const envEmails = getBootstrapAdminEmails()
    if (envEmails.length) {
      const { promoted } = await promoteBootstrapAdminsByEmail(envEmails)
      console.log('')
      console.log(
        `STARFORGE_ADMIN_EMAILS promote: ${promoted.length ? promoted.join(', ') : '(no matching users yet — register those emails)'}`,
      )
    }
  } catch (error) {
    console.warn('')
    console.warn('Could not create demo app users (core tables may be missing).')
    console.warn('Run: npm run db:core:push')
    console.warn(error instanceof Error ? error.message : error)
  }

  try {
    const { enabled, failed } = await seedCmsAccessForAdmins()
    console.log('')
    console.log(
      `CMS access (+ Payload stub) for admins: ${enabled.length ? enabled.join(', ') : '(none)'}`,
    )
    for (const fail of failed) {
      console.warn(`CMS access failed for ${fail.email}: ${fail.error}`)
    }
    console.log('Open /admin after /login — no second password prompt.')
  } catch (error) {
    console.warn('')
    console.warn('Could not ensure CMS access / Payload stubs.')
    console.warn(error instanceof Error ? error.message : error)
  }

  console.log('')
  console.log('Try: http://localhost:3000/about  ·  /getting-started  ·  /welcome')
  console.log('Notice bar (modules): header position when Modules is on')
  console.log('Login once: http://localhost:3000/login  then open http://localhost:3000/admin')
  console.log('Core admin users:    http://localhost:3000/app/admin/users')
  console.log('Core user groups:    http://localhost:3000/app/admin/users/groups')
  console.log('Core site settings:  http://localhost:3000/app/admin/settings')
  console.log('Core page settings:  http://localhost:3000/app/admin/page-settings')
  console.log('Core layout manager: http://localhost:3000/app/admin/layouts')
  console.log('Payload CMS:         http://localhost:3000/admin  (nav: Payload CMS)')
  console.log('')

  process.exit(0)
}

main().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
