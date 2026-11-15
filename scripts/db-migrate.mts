/**
 * Apply Core (Drizzle / public.sf_*) then Payload (payload.*) migrations.
 * Re-runs `0043_site_settings` after Payload so a fresh database can copy
 * `payload.site_settings` once the Payload schema exists (the Core journal
 * step runs first). The SQL is idempotent: a row with `payload_copied_at`
 * set is left alone.
 *
 * Verifies `sf_sessions`, locked-document rel columns, and `sf_site_settings`.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { Client } from 'pg'
import 'dotenv/config'

import { SITE_SETTINGS_CORE_VERIFY_COLUMNS } from '../src/core/settings/heal-site-settings-schema.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SITE_SETTINGS_MIGRATION = join(
  root,
  'src/core/db/migrations/0043_site_settings.sql',
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

async function replaySiteSettingsMigration(client: Client): Promise<void> {
  const sql = readFileSync(SITE_SETTINGS_MIGRATION, 'utf8')
  const statements = sql
    .split('--> statement-breakpoint')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
  for (const statement of statements) {
    await client.query(statement)
  }
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

    const tagsOk = await columnExists(
      client,
      'payload',
      'payload_locked_documents_rels',
      'tags_id',
    )
    if (!tagsOk) {
      throw new Error(
        'payload.payload_locked_documents_rels.tags_id missing after migrate',
      )
    }

    const categoriesOk = await columnExists(
      client,
      'payload',
      'payload_locked_documents_rels',
      'categories_id',
    )
    if (!categoriesOk) {
      throw new Error(
        'payload.payload_locked_documents_rels.categories_id missing after migrate',
      )
    }

    console.log(
      '\n→ Copy site settings into public.sf_site_settings (idempotent; skips when payload_copied_at is set)',
    )
    await replaySiteSettingsMigration(client)

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

    console.log(
      '\n✓ Verified public.sf_sessions + locked-docs tags_id/categories_id + public.sf_site_settings',
    )
  } finally {
    await client.end()
  }
}

run('Core Drizzle (sf_*)', ['run', 'db:core:migrate'])
run('Payload (payload.*)', ['run', 'payload:migrate'])
try {
  await verifyAndHeal()
} catch (err) {
  console.error(`\n✗ ${err instanceof Error ? err.message : err}`)
  process.exit(1)
}
