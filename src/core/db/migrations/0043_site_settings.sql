-- Site settings peel: Core singleton. Idempotent.
-- Copies payload.site_settings (+ module_toggles, legacy primary_nav) once.
-- payload_copied_at stays NULL until a payload table was seen, so a later
-- re-run (db:migrate runs this again after Payload migrate) can still copy.
-- App writes never set payload_copied_at, and never overwrite a copied row.
CREATE TABLE IF NOT EXISTS "sf_site_settings" (
  "id" text PRIMARY KEY NOT NULL,
  "site_name" text DEFAULT 'Starforge' NOT NULL,
  "primary_nav_menu_id" text DEFAULT 'main' NOT NULL,
  "admin_autosave_debounce_ms" integer DEFAULT 800 NOT NULL,
  "form_rate_limit_max" integer DEFAULT 8 NOT NULL,
  "form_rate_limit_window_sec" integer DEFAULT 60 NOT NULL,
  "published_cache_enabled" boolean DEFAULT true NOT NULL,
  "published_cache_ttl_sec" integer DEFAULT 0 NOT NULL,
  "null_miss_ttl_sec" integer DEFAULT 60 NOT NULL,
  "dashboard_refresh_interval_sec" integer DEFAULT 60 NOT NULL,
  "dashboard_online_window_min" integer DEFAULT 15 NOT NULL,
  "realtime_enabled" boolean DEFAULT true NOT NULL,
  "feature_registration" boolean DEFAULT true NOT NULL,
  "feature_rich_editor" boolean DEFAULT true NOT NULL,
  "feature_posts" boolean DEFAULT false NOT NULL,
  "feature_modules" boolean DEFAULT false NOT NULL,
  "feature_draft_preview" boolean DEFAULT false NOT NULL,
  "module_toggles" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "legacy_primary_nav" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "payload_copied_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sf_site_settings" ADD COLUMN IF NOT EXISTS "site_name" text DEFAULT 'Starforge' NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_site_settings" ADD COLUMN IF NOT EXISTS "primary_nav_menu_id" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_site_settings" ADD COLUMN IF NOT EXISTS "admin_autosave_debounce_ms" integer DEFAULT 800 NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_site_settings" ADD COLUMN IF NOT EXISTS "form_rate_limit_max" integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_site_settings" ADD COLUMN IF NOT EXISTS "form_rate_limit_window_sec" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_site_settings" ADD COLUMN IF NOT EXISTS "published_cache_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_site_settings" ADD COLUMN IF NOT EXISTS "published_cache_ttl_sec" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_site_settings" ADD COLUMN IF NOT EXISTS "null_miss_ttl_sec" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_site_settings" ADD COLUMN IF NOT EXISTS "dashboard_refresh_interval_sec" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_site_settings" ADD COLUMN IF NOT EXISTS "dashboard_online_window_min" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_site_settings" ADD COLUMN IF NOT EXISTS "realtime_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_site_settings" ADD COLUMN IF NOT EXISTS "feature_registration" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_site_settings" ADD COLUMN IF NOT EXISTS "feature_rich_editor" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_site_settings" ADD COLUMN IF NOT EXISTS "feature_posts" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_site_settings" ADD COLUMN IF NOT EXISTS "feature_modules" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_site_settings" ADD COLUMN IF NOT EXISTS "feature_draft_preview" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_site_settings" ADD COLUMN IF NOT EXISTS "module_toggles" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_site_settings" ADD COLUMN IF NOT EXISTS "legacy_primary_nav" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_site_settings" ADD COLUMN IF NOT EXISTS "payload_copied_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sf_site_settings" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_site_settings" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
DO $$
DECLARE
  doc jsonb;
  parent_id integer;
  toggles jsonb := '[]'::jsonb;
  legacy jsonb := '[]'::jsonb;
  payload_table boolean;
BEGIN
  IF EXISTS (
    SELECT 1 FROM "sf_site_settings"
    WHERE "id" = 'global' AND "payload_copied_at" IS NOT NULL
  ) THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'payload' AND table_name = 'site_settings'
  ) INTO payload_table;

  IF payload_table THEN
    SELECT to_jsonb(s) INTO doc
    FROM "payload"."site_settings" s
    ORDER BY s.id
    LIMIT 1;
  END IF;

  IF doc IS NULL THEN
    INSERT INTO "sf_site_settings" ("id")
    VALUES ('global')
    ON CONFLICT ("id") DO NOTHING;

    IF payload_table THEN
      UPDATE "sf_site_settings"
      SET "payload_copied_at" = now()
      WHERE "id" = 'global' AND "payload_copied_at" IS NULL;
    END IF;
    RETURN;
  END IF;

  parent_id := NULLIF(doc->>'id', '')::integer;

  IF parent_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'payload' AND table_name = 'site_settings_module_toggles'
  ) THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'moduleId', t.module_id,
          'enabled', COALESCE(t.enabled, true)
        )
        ORDER BY t._order
      ),
      '[]'::jsonb
    )
    INTO toggles
    FROM "payload"."site_settings_module_toggles" t
    WHERE t._parent_id = parent_id
      AND btrim(t.module_id) <> '';
  END IF;

  IF parent_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'payload' AND table_name = 'site_settings_primary_nav'
  ) THEN
    BEGIN
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'label', n.label,
            'linkType', n.link_type::text,
            'page', CASE
              WHEN n.page_id IS NULL THEN NULL
              ELSE jsonb_build_object(
                'id', n.page_id,
                'slug', (SELECT p.slug FROM "payload"."pages" p WHERE p.id = n.page_id)
              )
            END,
            'url', n.url,
            'cssClass', n.css_class,
            'browserTitle', n.browser_title
          )
          ORDER BY n._order
        ),
        '[]'::jsonb
      )
      INTO legacy
      FROM "payload"."site_settings_primary_nav" n
      WHERE n._parent_id = parent_id;
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        BEGIN
          SELECT COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'label', n.label,
                'linkType', n.link_type::text,
                'page', CASE
                  WHEN n.page_id IS NULL THEN NULL
                  ELSE jsonb_build_object('id', n.page_id)
                END,
                'url', n.url,
                'cssClass', n.css_class,
                'browserTitle', n.browser_title
              )
              ORDER BY n._order
            ),
            '[]'::jsonb
          )
          INTO legacy
          FROM "payload"."site_settings_primary_nav" n
          WHERE n._parent_id = parent_id;
        EXCEPTION
          WHEN undefined_table OR undefined_column THEN
            legacy := '[]'::jsonb;
        END;
    END;
  END IF;

  INSERT INTO "sf_site_settings" (
    "id",
    "site_name",
    "primary_nav_menu_id",
    "admin_autosave_debounce_ms",
    "form_rate_limit_max",
    "form_rate_limit_window_sec",
    "published_cache_enabled",
    "published_cache_ttl_sec",
    "null_miss_ttl_sec",
    "dashboard_refresh_interval_sec",
    "dashboard_online_window_min",
    "realtime_enabled",
    "feature_registration",
    "feature_rich_editor",
    "feature_posts",
    "feature_modules",
    "feature_draft_preview",
    "module_toggles",
    "legacy_primary_nav",
    "payload_copied_at",
    "created_at",
    "updated_at"
  ) VALUES (
    'global',
    COALESCE(NULLIF(btrim(doc->>'site_name'), ''), 'Starforge'),
    COALESCE(NULLIF(btrim(doc->>'primary_nav_menu_id'), ''), 'main'),
    CASE
      WHEN doc ? 'admin_autosave_debounce_ms'
        AND btrim(doc->>'admin_autosave_debounce_ms') ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN ROUND((doc->>'admin_autosave_debounce_ms')::numeric)::integer
      ELSE 800
    END,
    CASE
      WHEN doc ? 'form_rate_limit_max'
        AND btrim(doc->>'form_rate_limit_max') ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN ROUND((doc->>'form_rate_limit_max')::numeric)::integer
      ELSE 8
    END,
    CASE
      WHEN doc ? 'form_rate_limit_window_sec'
        AND btrim(doc->>'form_rate_limit_window_sec') ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN ROUND((doc->>'form_rate_limit_window_sec')::numeric)::integer
      ELSE 60
    END,
    CASE
      WHEN lower(btrim(COALESCE(doc->>'published_cache_enabled', ''))) IN ('false', 'f', '0', 'no', 'off')
      THEN false
      ELSE true
    END,
    CASE
      WHEN doc ? 'published_cache_ttl_sec'
        AND btrim(doc->>'published_cache_ttl_sec') ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN ROUND((doc->>'published_cache_ttl_sec')::numeric)::integer
      ELSE 0
    END,
    CASE
      WHEN doc ? 'null_miss_ttl_sec'
        AND btrim(doc->>'null_miss_ttl_sec') ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN ROUND((doc->>'null_miss_ttl_sec')::numeric)::integer
      ELSE 60
    END,
    CASE
      WHEN doc ? 'dashboard_refresh_interval_sec'
        AND btrim(doc->>'dashboard_refresh_interval_sec') ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN ROUND((doc->>'dashboard_refresh_interval_sec')::numeric)::integer
      ELSE 60
    END,
    CASE
      WHEN doc ? 'dashboard_online_window_min'
        AND btrim(doc->>'dashboard_online_window_min') ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN ROUND((doc->>'dashboard_online_window_min')::numeric)::integer
      ELSE 15
    END,
    CASE
      WHEN lower(btrim(COALESCE(doc->>'realtime_enabled', ''))) IN ('false', 'f', '0', 'no', 'off')
      THEN false
      ELSE true
    END,
    CASE
      WHEN lower(btrim(COALESCE(doc->>'feature_registration', ''))) IN ('false', 'f', '0', 'no', 'off')
      THEN false
      ELSE true
    END,
    CASE
      WHEN lower(btrim(COALESCE(doc->>'feature_rich_editor', ''))) IN ('false', 'f', '0', 'no', 'off')
      THEN false
      ELSE true
    END,
    CASE
      WHEN lower(btrim(COALESCE(doc->>'feature_posts', ''))) IN ('true', 't', '1', 'yes', 'on')
      THEN true
      ELSE false
    END,
    CASE
      WHEN lower(btrim(COALESCE(doc->>'feature_modules', ''))) IN ('true', 't', '1', 'yes', 'on')
      THEN true
      ELSE false
    END,
    CASE
      WHEN lower(btrim(COALESCE(doc->>'feature_draft_preview', ''))) IN ('true', 't', '1', 'yes', 'on')
      THEN true
      ELSE false
    END,
    toggles,
    legacy,
    now(),
    COALESCE(
      CASE
        WHEN doc ? 'created_at' AND NULLIF(btrim(doc->>'created_at'), '') IS NOT NULL
        THEN (doc->>'created_at')::timestamptz
      END,
      now()
    ),
    now()
  )
  ON CONFLICT ("id") DO UPDATE SET
    "site_name" = EXCLUDED."site_name",
    "primary_nav_menu_id" = EXCLUDED."primary_nav_menu_id",
    "admin_autosave_debounce_ms" = EXCLUDED."admin_autosave_debounce_ms",
    "form_rate_limit_max" = EXCLUDED."form_rate_limit_max",
    "form_rate_limit_window_sec" = EXCLUDED."form_rate_limit_window_sec",
    "published_cache_enabled" = EXCLUDED."published_cache_enabled",
    "published_cache_ttl_sec" = EXCLUDED."published_cache_ttl_sec",
    "null_miss_ttl_sec" = EXCLUDED."null_miss_ttl_sec",
    "dashboard_refresh_interval_sec" = EXCLUDED."dashboard_refresh_interval_sec",
    "dashboard_online_window_min" = EXCLUDED."dashboard_online_window_min",
    "realtime_enabled" = EXCLUDED."realtime_enabled",
    "feature_registration" = EXCLUDED."feature_registration",
    "feature_rich_editor" = EXCLUDED."feature_rich_editor",
    "feature_posts" = EXCLUDED."feature_posts",
    "feature_modules" = EXCLUDED."feature_modules",
    "feature_draft_preview" = EXCLUDED."feature_draft_preview",
    "module_toggles" = EXCLUDED."module_toggles",
    "legacy_primary_nav" = EXCLUDED."legacy_primary_nav",
    "payload_copied_at" = EXCLUDED."payload_copied_at",
    "updated_at" = EXCLUDED."updated_at"
  WHERE "sf_site_settings"."payload_copied_at" IS NULL;
END $$;
