/**
 * Apply Core (Drizzle / public.sf_*) then Payload (payload.*) migrations.
 * Fails if either step fails or expected tables/columns are missing.
 */
import { spawnSync } from 'node:child_process'
import { Client } from 'pg'
import 'dotenv/config'

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

async function verify(): Promise<void> {
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
      '\n✓ Verified public.sf_sessions + payload.payload_locked_documents_rels.tags_id + categories_id',
    )
  } finally {
    await client.end()
  }
}

run('Core Drizzle (sf_*)', ['run', 'db:core:migrate'])
run('Payload (payload.*)', ['run', 'payload:migrate'])
try {
  await verify()
} catch (err) {
  console.error(`\n✗ ${err instanceof Error ? err.message : err}`)
  process.exit(1)
}
