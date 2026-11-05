/**
 * Apply Core (Drizzle / public.sf_*) then Payload (payload.*) migrations.
 * After Payload migrate, idempotently heal site_settings Performance columns
 * (covers journal-stuck / push-era DBs), then verify expected tables/columns.
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

async function tableExists(
  client: Client,
  schema: string,
  table: string,
): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = $1 AND table_name = $2
     ) AS exists`,
    [schema, table],
  )
  return Boolean(result.rows[0]?.exists)
}

/**
 * Belt-and-suspenders: Payload migration heals these too, but push-era /
 * partially-journaled local DBs can leave site_settings without Performance
 * columns even after `payload migrate` reports success. Always apply IF NOT EXISTS.
 */
async function healSiteSettingsSchema(client: Client): Promise<void> {
  const hasTable = await tableExists(client, 'payload', 'site_settings')
  if (!hasTable) {
    console.log(
      '  (skip site_settings heal — payload.site_settings missing; Payload baseline did not apply)',
    )
    return
  }

  console.log('\n→ Heal payload.site_settings Performance / feature columns (idempotent)')
  await client.query(`
    ALTER TABLE "payload"."site_settings"
      ADD COLUMN IF NOT EXISTS "site_name" varchar DEFAULT 'Starforge';
    ALTER TABLE "payload"."site_settings"
      ADD COLUMN IF NOT EXISTS "primary_nav_menu_id" varchar DEFAULT 'main';
    ALTER TABLE "payload"."site_settings"
      ADD COLUMN IF NOT EXISTS "admin_autosave_debounce_ms" numeric DEFAULT 800;
    ALTER TABLE "payload"."site_settings"
      ADD COLUMN IF NOT EXISTS "form_rate_limit_max" numeric DEFAULT 8;
    ALTER TABLE "payload"."site_settings"
      ADD COLUMN IF NOT EXISTS "form_rate_limit_window_sec" numeric DEFAULT 60;
    ALTER TABLE "payload"."site_settings"
      ADD COLUMN IF NOT EXISTS "published_cache_enabled" boolean DEFAULT true;
    ALTER TABLE "payload"."site_settings"
      ADD COLUMN IF NOT EXISTS "published_cache_ttl_sec" numeric DEFAULT 0;
    ALTER TABLE "payload"."site_settings"
      ADD COLUMN IF NOT EXISTS "null_miss_ttl_sec" numeric DEFAULT 60;
    ALTER TABLE "payload"."site_settings"
      ADD COLUMN IF NOT EXISTS "feature_registration" boolean DEFAULT true;
    ALTER TABLE "payload"."site_settings"
      ADD COLUMN IF NOT EXISTS "feature_rich_editor" boolean DEFAULT true;
    ALTER TABLE "payload"."site_settings"
      ADD COLUMN IF NOT EXISTS "feature_posts" boolean DEFAULT false;
    ALTER TABLE "payload"."site_settings"
      ADD COLUMN IF NOT EXISTS "feature_modules" boolean DEFAULT false;
    ALTER TABLE "payload"."site_settings"
      ADD COLUMN IF NOT EXISTS "feature_draft_preview" boolean DEFAULT false;
    ALTER TABLE "payload"."site_settings"
      ADD COLUMN IF NOT EXISTS "updated_at" timestamp(3) with time zone;
    ALTER TABLE "payload"."site_settings"
      ADD COLUMN IF NOT EXISTS "created_at" timestamp(3) with time zone;

    CREATE TABLE IF NOT EXISTS "payload"."site_settings_module_toggles" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "module_id" varchar NOT NULL,
      "enabled" boolean DEFAULT true
    );

    DO $$ BEGIN
      ALTER TABLE "payload"."site_settings_module_toggles"
        ADD CONSTRAINT "site_settings_module_toggles_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "payload"."site_settings"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN undefined_table THEN NULL;
      WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "site_settings_module_toggles_order_idx"
      ON "payload"."site_settings_module_toggles" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "site_settings_module_toggles_parent_id_idx"
      ON "payload"."site_settings_module_toggles" USING btree ("_parent_id");
  `)
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

    await healSiteSettingsSchema(client)

    const siteSettingsCols = [
      'form_rate_limit_max',
      'form_rate_limit_window_sec',
      'published_cache_enabled',
      'published_cache_ttl_sec',
      'null_miss_ttl_sec',
      'feature_registration',
      'feature_modules',
    ] as const
    for (const col of siteSettingsCols) {
      const ok = await columnExists(client, 'payload', 'site_settings', col)
      if (!ok) {
        throw new Error(
          `payload.site_settings.${col} missing after migrate + heal`,
        )
      }
    }

    const togglesOk = await tableExists(
      client,
      'payload',
      'site_settings_module_toggles',
    )
    if (!togglesOk) {
      throw new Error(
        'payload.site_settings_module_toggles missing after migrate + heal',
      )
    }

    console.log(
      '\n✓ Verified public.sf_sessions + locked-docs tags_id/categories_id + site_settings Performance/feature columns + module_toggles',
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
