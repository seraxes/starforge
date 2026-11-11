/**
 * Walk layout + nav documents → write `data/content-locales/{locale}/…`,
 * strip embedded *Locales maps. Idempotent.
 *
 * Usage (DB up, `.env` present):
 *   npm run migrate:content-locales
 */
import 'dotenv/config'

import { migrateEmbeddedContentLocalesToFiles } from '../src/core/i18n/content-locales/migrate.ts'

async function main() {
  console.log('→ Migrating embedded content locales to data/content-locales/…')
  const result = await migrateEmbeddedContentLocalesToFiles()
  console.log(
    `✓ Done — layouts updated: ${result.layouts}, slots touched: ${result.slotsTouched}, nav menus: ${result.navMenus}, nav items: ${result.navItemsTouched}`,
  )
  console.log('  Files under data/content-locales/{locale}/layouts|nav/')
}

main().catch((err) => {
  console.error('✗ migrate:content-locales failed', err)
  process.exit(1)
})
