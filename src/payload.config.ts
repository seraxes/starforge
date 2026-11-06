import { postgresAdapter } from '@payloadcms/db-postgres'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { DEFAULT_LOCALE, LOCALES, LOCALE_LABELS } from './core/i18n/locales'
import { payloadMediaStoragePlugins } from './core/media/storage/payload-plugin'
import { payloadCsrfOrigins } from './core/security/trusted-origins'
import { Categories } from './collections/Categories'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Tags } from './collections/Tags'
import { Users } from './collections/Users'
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
  // Payload UI under /cms/admin (Core Starforge admin owns /admin).
  routes: {
    admin: '/cms/admin',
  },
  admin: {
    user: Users.slug,
    // Lock dark — Starforge Gantry theme (see src/core/admin-theme).
    theme: 'dark',
    importMap: {
      baseDir: path.resolve(dirname),
      importMapFile: path.resolve(dirname, 'app/(payload)/cms/admin/importMap.js'),
    },
    meta: {
      // Browser tab: Content CMS surface (pair with Starforge Core admin at /admin).
      titleSuffix: '— Starforge Content CMS',
    },
    components: {
      // Belt-and-suspenders with src/proxy.ts (which blocks /cms/admin/login).
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

  collections: [Users, Media, Pages, Tags, Categories],
  globals: [SiteSettings],
  /**
   * Content locales (i18n P1) — code-bootstrapped from Core bootstrap catalog
   * (`en`/`hu`). Admin-added locales under `/admin/localization` honor public
   * routing immediately but do **not** hot-reload into Payload — add codes here
   * and restart for CMS field locales. Public loaders map unknown route locales
   * via `toPayloadLocale` until this config catches up.
   */
  localization: {
    locales: LOCALES.map((code) => ({
      code,
      label: LOCALE_LABELS[code],
    })),
    defaultLocale: DEFAULT_LOCALE,
    fallback: true,
  },
  // No root Lexical editor — Pages body is TipTap HTML (product:rich-editor).
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
    // Explicit migrations dir (SF-139). Default push only in local scratch when
    // STARFORGE_PAYLOAD_PUSH=1 — CI / deploy always migrate with push off.
    migrationDir: path.resolve(dirname, 'migrations'),
    push: process.env.STARFORGE_PAYLOAD_PUSH === '1',
  }),
  sharp,
  plugins: [...payloadMediaStoragePlugins()],
})
