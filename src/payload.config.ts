import { postgresAdapter } from '@payloadcms/db-postgres'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Users } from './collections/Users'
import { pagesLexicalEditor } from './fields/pagesLexical'
import { SiteSettings } from './globals/SiteSettings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * Payload is Starforge's *content/media module* only.
 * Product auth, app users, and public APIs belong in `src/core/` — not here.
 */
export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      // Browser tab: Content CMS surface (pair with Starforge / App admin at /app/admin).
      titleSuffix: '— Starforge Content CMS',
    },
    components: {
      // Belt-and-suspenders with src/middleware.ts (which blocks /admin/login).
      views: {
        login: {
          Component: '@/components/payload/AdminLoginRedirect',
        },
      },
      beforeLogin: [
        '@/components/payload/AdminLoginRedirect',
        '@/components/payload/KillPayloadLoginForm',
      ],
      // Persistent link back to Starforge / App admin (users, settings).
      afterNavLinks: ['@/components/payload/CoreAdminNavLink'],
    },
  },
  // Empty = accept cookie JWT from any Origin (needed for admin RSC).
  csrf: [],

  collections: [Users, Media, Pages],
  globals: [SiteSettings],
  // Default rich text = Pages Lexical (headings, lists, links, Media uploads + fixed toolbar).
  editor: pagesLexicalEditor,
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    // Keep CMS tables out of `public` so core Drizzle tables do not collide.
    schemaName: 'payload',
  }),
  sharp,
})
