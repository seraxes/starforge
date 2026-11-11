import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Pages body is TipTap HTML (textarea), not Lexical JSON.
 * `pages_locales.body` and `_pages_v_locales.version_body` were still jsonb,
 * so a sanitized HTML string failed to insert.
 * Object values become their JSON text so unread Lexical documents stay parseable.
 */
const toHtmlText = (column: string) => sql.raw(`
  CASE
    WHEN "${column}" IS NULL THEN NULL
    WHEN jsonb_typeof("${column}"::jsonb) = 'string' THEN "${column}"::jsonb #>> '{}'
    ELSE "${column}"::text
  END
`)

const toJsonb = (column: string) => sql.raw(`
  CASE
    WHEN "${column}" IS NULL THEN NULL
    WHEN left(btrim("${column}"), 1) = '{' THEN "${column}"::jsonb
    ELSE to_jsonb("${column}")
  END
`)

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload"."pages_locales"
    ALTER COLUMN "body" TYPE varchar
    USING ${toHtmlText('body')};
  ALTER TABLE "payload"."_pages_v_locales"
    ALTER COLUMN "version_body" TYPE varchar
    USING ${toHtmlText('version_body')};
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload"."pages_locales"
    ALTER COLUMN "body" TYPE jsonb
    USING ${toJsonb('body')};
  ALTER TABLE "payload"."_pages_v_locales"
    ALTER COLUMN "version_body" TYPE jsonb
    USING ${toJsonb('version_body')};
  `)
}
