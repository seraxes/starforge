import { postgresAdapter } from '@payloadcms/db-postgres'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { payloadMediaStoragePlugins } from './core/media/storage/payload-plugin'
import { payloadCsrfOrigins } from './core/security/trusted-origins'
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
 *
 * Media blobs: local `staticDir` by default; Spaces/S3 when
 * `STARFORGE_MEDIA_STORAGE=s3` + `S3_*` env (see MediaStorage port).
 * Image pipeline stays sharp (resizeOptions / imageSizes) — storage swap only.
 */
export default buildConfig({
  admin: {
    user: Users.slug,
    // Lock dark — Starforge Gantry theme (see src/core/admin-theme).
    theme: 'dark',
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
      // Shared Core↔Payload left nav (replaces DefaultNav + old CoreAdminNavLink).
      Nav: '@/components/payload/StarforgeAdminNav',
    },
  },
  // App origins only (an empty list accepts the cookie JWT from any Origin).
  // Add extra hosts via STARFORGE_TRUSTED_ORIGINS.
  csrf: payloadCsrfOrigins(),

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
  plugins: [...payloadMediaStoragePlugins()],
})
