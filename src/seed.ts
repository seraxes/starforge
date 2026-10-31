/**
 * Local demo seed for Starforge.
 *
 * Creates sample **published** CMS pages (Payload). Optionally creates one
 * **core app user** (Better Auth) — never a Payload CMS editor.
 *
 * Usage (Compose up, `.env` present, core tables pushed):
 *   npm run seed
 *
 * Idempotent: skips pages / app user that already exist.
 */
import 'dotenv/config'

import { getPayload } from 'payload'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

import config from '@payload-config'
import { auth } from './core/auth'
import {
  getBootstrapAdminEmails,
  promoteBootstrapAdminsByEmail,
  setUserRole,
} from './core/auth/admin'
import { db } from './core/db'
import { sfUsers } from './core/db/schema'
import { eq } from 'drizzle-orm'

const DEMO_APP_EMAIL = 'demo@starforge.local'
const DEMO_APP_PASSWORD = 'starforge-demo'
const DEMO_APP_NAME = 'Demo Member'

/** Local bootstrap admin (core /app/admin — not Payload CMS). */
const BOOTSTRAP_ADMIN_EMAIL = 'admin@starforge.local'
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
        'CMS editors: Payload /admin (separate accounts)',
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
        'Edit pages in /admin (create a CMS editor on first visit)',
        'Register an app account at /register if you did not use the demo user',
      ),
      heading('h3', 'Two kinds of users'),
      paragraph(
        textNode(
          'Payload /admin users edit content. Core /login users are product accounts. Creating one never creates the other.',
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
    }
    return { created: false as const, email: BOOTSTRAP_ADMIN_EMAIL }
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

  return { created: true as const, email: BOOTSTRAP_ADMIN_EMAIL }
}

async function main() {
  console.log('')
  console.log('Starforge seed')
  console.log('--------------')
  console.log('CMS editors (Payload /admin) are NOT created here.')
  console.log('Create the first CMS editor in the browser at http://localhost:3000/admin')
  console.log('App accounts (/login) are separate from CMS editors.')
  console.log('Core admin UI: http://localhost:3000/app/admin/users (app role admin only).')
  console.log('')

  const pages = await seedPages()
  if (pages.created.length) {
    console.log(`Pages created (published): ${pages.created.map((s) => `/${s}`).join(', ')}`)
  }
  if (pages.skipped.length) {
    console.log(`Pages skipped (already exist): ${pages.skipped.map((s) => `/${s}`).join(', ')}`)
  }

  try {
    const adminUser = await seedBootstrapAdmin()
    if (adminUser.created) {
      console.log('')
      console.log(`Bootstrap app admin created (core /app/admin — not CMS):`)
      console.log(`  email:    ${BOOTSTRAP_ADMIN_EMAIL}`)
      console.log(`  password: ${BOOTSTRAP_ADMIN_PASSWORD}`)
      console.log(`  role:     admin`)
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

  console.log('')
  console.log('Try: http://localhost:3000/about  ·  /getting-started  ·  /welcome')
  console.log('CMS:  http://localhost:3000/admin')
  console.log('App:  http://localhost:3000/login')
  console.log('Core admin users: http://localhost:3000/app/admin/users')
  console.log('')

  process.exit(0)
}

main().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
