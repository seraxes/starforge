/**
 * Apply Core (Drizzle / public.sf_*) migrations.
 * If the leftover `payload` schema is still present, copy site settings, media,
 * and pages into `sf_*` (idempotent), then drop that schema.
 * The drop is not in the Drizzle journal, so it cannot run before the copy.
 *
 * Verifies `sf_sessions`, `sf_site_settings`, `sf_media_assets`, and `sf_pages_versions`.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { Client } from 'pg'
import 'dotenv/config'

import { SITE_SETTINGS_CORE_VERIFY_COLUMNS } from '../src/core/settings/heal-site-settings-schema.ts'
import { migratePayloadPages } from '../src/modules/pages/migrate-from-payload.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SITE_SETTINGS_MIGRATION = join(
  root,
  'src/core/db/migrations/0043_site_settings.sql',
)
const MEDIA_STORE_MIGRATION = join(
  root,
  'src/core/db/migrations/0044_media_document_store.sql',
)
const DROP_PAYLOAD_SCHEMA = join(
  root,
  'src/core/db/migrations/0048_drop_payload_schema.sql',
)

function run(label: string, args: string[]): void {
  console.log(`\n→ ${label}`)
  const result = spawnSync('npm', args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  })
  if (result.status !== 0) {
    console.error(`\n✗ ${label} failed (exit ${result.status ?? 'unknown'})`)
    process.exit(result.status ?? 1)
  }
}

async function columnExists(
  client: Client,
  schema: string,
  table: string,
  column: string,
): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = $1
         AND table_name = $2
         AND column_name = $3
     ) AS exists`,
    [schema, table, column],
  )
  return Boolean(result.rows[0]?.exists)
}

async function replaySqlFile(client: Client, filePath: string): Promise<void> {
  const sql = readFileSync(filePath, 'utf8')
  const statements = sql
    .split('--> statement-breakpoint')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
  for (const statement of statements) {
    await client.query(statement)
  }
}

async function replaySiteSettingsMigration(client: Client): Promise<void> {
  await replaySqlFile(client, SITE_SETTINGS_MIGRATION)
}

async function replayMediaStoreMigration(client: Client): Promise<void> {
  await replaySqlFile(client, MEDIA_STORE_MIGRATION)
}

async function verifyAndHeal(): Promise<void> {
  const url =
    process.env.DATABASE_URL ||
    'postgresql://starforge:starforge@127.0.0.1:5432/starforge'
  const client = new Client({ connectionString: url })
  await client.connect()
  try {
    const sessions = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'sf_sessions'
       ) AS exists`,
    )
    if (!sessions.rows[0]?.exists) {
      throw new Error(
        'public.sf_sessions missing after migrate — Core Drizzle baseline did not apply',
      )
    }

    console.log(
      '\n→ Copy site settings into public.sf_site_settings (idempotent; skips when payload schema is already gone)',
    )
    await replaySiteSettingsMigration(client)

    console.log(
      '\n→ Copy Payload media into public.sf_media_* (idempotent; skips rows already copied)',
    )
    await replayMediaStoreMigration(client)

    console.log(
      '\n→ Copy Payload pages into public.sf_pages_* (idempotent; skips rows already copied)',
    )
    const pagesCopy = await migratePayloadPages(client)
    console.log(
      `  pages ${pagesCopy.pagesCopied}, skipped ${pagesCopy.pagesSkipped}, tags ${pagesCopy.tagsCopied}, versions ${pagesCopy.versionsCopied}, locale files ${pagesCopy.localesWritten}, nav binds ${pagesCopy.navItemsRemapped}${pagesCopy.note ? ` (${pagesCopy.note})` : ''}`,
    )

    console.log('\n→ Drop leftover payload schema (idempotent)')
    await replaySqlFile(client, DROP_PAYLOAD_SCHEMA)

    for (const col of SITE_SETTINGS_CORE_VERIFY_COLUMNS) {
      const ok = await columnExists(client, 'public', 'sf_site_settings', col)
      if (!ok) {
        throw new Error(
          `public.sf_site_settings.${col} missing after migrate`,
        )
      }
    }

    const row = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM "sf_site_settings" WHERE "id" = 'global'
       ) AS exists`,
    )
    if (!row.rows[0]?.exists) {
      throw new Error('public.sf_site_settings global row missing after migrate')
    }

    const mediaTable = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'sf_media_assets'
       ) AS exists`,
    )
    if (!mediaTable.rows[0]?.exists) {
      throw new Error('public.sf_media_assets missing after migrate')
    }

    const pagesVersions = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'sf_pages_versions'
       ) AS exists`,
    )
    if (!pagesVersions.rows[0]?.exists) {
      throw new Error('public.sf_pages_versions missing after migrate')
    }

    console.log(
      '\n✓ Verified public.sf_sessions + public.sf_site_settings + public.sf_media_assets + public.sf_pages_versions',
    )
  } finally {
    await client.end()
  }
}

run('Core Drizzle (sf_*)', ['run', 'db:core:migrate'])
try {
  await verifyAndHeal()
} catch (err) {
  console.error(`\n✗ ${err instanceof Error ? err.message : err}`)
  process.exit(1)
}
