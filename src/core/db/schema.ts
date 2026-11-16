import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

/** Stable id for the active site layout document row. */
export const DEFAULT_LAYOUT_ID = 'default'

/**
 * Starforge core tables (public schema).
 * Prefixed `sf_` so names never collide with Payload's `payload` schema tables.
 *
 * Shape matches Better Auth's core models (user / session / account / verification).
 * Passwords live on `sf_accounts` (credential provider), not on the user row.
 */

export const sfUsers = pgTable('sf_users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  /**
   * Better Auth admin plugin roles.
   * Starforge uses `admin` (global app admin) and `member` (default).
   */
  role: text('role').default('member').notNull(),
  /**
   * When true, this core user may edit brochure pages and open draft preview.
   * Global admins get this by default. Sign-in is Better Auth only.
   */
  cmsAccess: boolean('cms_access').default(false).notNull(),
  banned: boolean('banned').default(false).notNull(),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires', { withTimezone: true }),
  /**
   * Better Auth twoFactor plugin — true after TOTP enrollment is verified.
   * Column: `two_factor_enabled`. Apply with `npm run db:core:push` after pull.
   */
  twoFactorEnabled: boolean('two_factor_enabled').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

/**
 * Better Auth twoFactor plugin secrets + backup codes (encrypted/hashed by BA).
 * Physical table `sf_two_factors`; adapter model key stays `twoFactor`.
 */
export const sfTwoFactors = pgTable(
  'sf_two_factors',
  {
    id: text('id').primaryKey(),
    secret: text('secret').notNull(),
    backupCodes: text('backup_codes').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => sfUsers.id, { onDelete: 'cascade' }),
    verified: boolean('verified').default(true),
    failedVerificationCount: integer('failed_verification_count').default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
  },
  (table) => [
    index('sf_two_factors_user_id_idx').on(table.userId),
    index('sf_two_factors_secret_idx').on(table.secret),
  ],
)

export const sfSessions = pgTable(
  'sf_sessions',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => sfUsers.id, { onDelete: 'cascade' }),
    /** Better Auth admin plugin — column `impersonated_by` (Core baseline). */
    impersonatedBy: text('impersonated_by'),
  },
  (table) => [index('sf_sessions_user_id_idx').on(table.userId)],
)

export const sfAccounts = pgTable(
  'sf_accounts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => sfUsers.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('sf_accounts_user_id_idx').on(table.userId)],
)

export const sfVerifications = pgTable(
  'sf_verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('sf_verifications_identifier_idx').on(table.identifier)],
)

/**
 * Layout outlines (Gantry-style named layouts).
 * Multiple rows: `id` is the stable slug (Page Settings `layoutId`);
 * `label` is the admin display name. Seed row `default` is Core bootstrap only.
 * Skin packs own rows via `skin_id` (nullable). Each skin has one Base shell
 * (`preferredDefaultOutlineId`); children inherit that Base by default.
 * Empty/missing document → fall back to `src/core/modules/default-layout.json`.
 * Apply `skin_id` with `npm run db:core:push` after pull.
 */
export const sfLayouts = pgTable('sf_layouts', {
  id: text('id').primaryKey(),
  /** Human display name (Outlines manager / Page Settings dropdown). */
  label: text('label').notNull().default('Untitled'),
  /** Canonical layout document JSON (version 3). */
  document: text('document').notNull(),
  /**
   * Owning skin package id (e.g. `starforge-pastel`). Null = Core / unassigned.
   * Set on skin seed install and on create/duplicate under an active skin.
   */
  skinId: text('skin_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

/**
 * Page Settings chrome (Gantry-style Head / Assets / Body / FA / Atoms).
 * Row id `global` = site defaults; other ids = pageKey (usually CMS slug, or `home`).
 */
export const GLOBAL_PAGE_CHROME_ID = 'global'

export const sfPageChrome = pgTable('sf_page_chrome', {
  id: text('id').primaryKey(),
  /** Canonical PageChrome JSON. */
  document: text('document').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

/**
 * Site Chrome (site-wide policy — offline, metadata, robots, cookies, …).
 * Singleton row `global`. Separate from `sf_site_settings` (Modules / nav
 * assignment / performance) and from `sf_page_chrome` (per-page document chrome).
 */
export const SITE_CHROME_ID = 'global'

export const sfSiteChrome = pgTable('sf_site_chrome', {
  id: text('id').primaryKey(),
  /** Canonical SiteChromeDocument JSON. */
  document: text('document').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

/**
 * Site settings (Modules, performance knobs, primary nav assignment).
 * Singleton row `global`. Not Site Chrome, and not a CMS document.
 * `legacy_primary_nav` is a one-time read fallback copied from Payload.
 * `payload_copied_at` is set by migration `0043_site_settings` only.
 */
export const SITE_SETTINGS_ID = 'global'

export const sfSiteSettings = pgTable('sf_site_settings', {
  id: text('id').primaryKey(),
  siteName: text('site_name').notNull().default('Starforge'),
  primaryNavMenuId: text('primary_nav_menu_id').notNull().default('main'),
  adminAutosaveDebounceMs: integer('admin_autosave_debounce_ms').notNull().default(800),
  formRateLimitMax: integer('form_rate_limit_max').notNull().default(8),
  formRateLimitWindowSec: integer('form_rate_limit_window_sec').notNull().default(60),
  publishedCacheEnabled: boolean('published_cache_enabled').notNull().default(true),
  publishedCacheTtlSec: integer('published_cache_ttl_sec').notNull().default(0),
  nullMissTtlSec: integer('null_miss_ttl_sec').notNull().default(60),
  dashboardRefreshIntervalSec: integer('dashboard_refresh_interval_sec').notNull().default(60),
  dashboardOnlineWindowMin: integer('dashboard_online_window_min').notNull().default(15),
  realtimeEnabled: boolean('realtime_enabled').notNull().default(true),
  featureRegistration: boolean('feature_registration').notNull().default(true),
  featureRichEditor: boolean('feature_rich_editor').notNull().default(true),
  featurePosts: boolean('feature_posts').notNull().default(false),
  featureModules: boolean('feature_modules').notNull().default(false),
  featureDraftPreview: boolean('feature_draft_preview').notNull().default(false),
  /** `{ moduleId, enabled }[]` — same shape `normalizeModuleToggles` reads. */
  moduleToggles: jsonb('module_toggles')
    .$type<Array<{ moduleId: string; enabled: boolean }>>()
    .notNull()
    .default([]),
  /** Legacy Payload `primaryNav` rows. Read fallback only; app writes leave it. */
  legacyPrimaryNav: jsonb('legacy_primary_nav').$type<unknown[]>().notNull().default([]),
  /** Set when migration 0043 has copied (or found nothing to copy). App writes leave it. */
  payloadCopiedAt: timestamp('payload_copied_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

/** Stable id for the default (site primary) navigation set. */
export const DEFAULT_NAV_MENU_ID = 'main'

/**
 * Navigation sets (menus) for the Nav manager.
 * Multiple rows: `id` is the stable slug; `document` is NavMenuDocument JSON
 * (items with page/URL binds, parentId, access-level stub, etc.).
 */
export const sfNavMenus = pgTable('sf_nav_menus', {
  id: text('id').primaryKey(),
  /** Human display name (Nav manager list). */
  label: text('label').notNull().default('Untitled'),
  /** Canonical NavMenuDocument JSON (version 1). */
  document: text('document').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

/**
 * Named user groups (Users → Groups). Membership is many-to-many via
 * `sf_user_group_members`. Optional `parent_id` nests groups; access checks
 * expand membership **up** the parent chain (child member also counts as
 * parent for nav `group:<id>` and ACL grants). Direct membership rows stay
 * explicit — no phantom ancestor rows.
 */
export const sfUserGroups = pgTable(
  'sf_user_groups',
  {
    id: text('id').primaryKey(),
    label: text('label').notNull(),
    description: text('description'),
    parentId: text('parent_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_user_groups_parent_id_idx').on(table.parentId),
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: 'sf_user_groups_parent_id_sf_user_groups_id_fk',
    }).onDelete('restrict'),
  ],
)

/** User ↔ group membership (a user may belong to many groups). */
export const sfUserGroupMembers = pgTable(
  'sf_user_group_members',
  {
    groupId: text('group_id')
      .notNull()
      .references(() => sfUserGroups.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => sfUsers.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.userId] }),
    index('sf_user_group_members_user_id_idx').on(table.userId),
  ],
)

/** Stable id for Media pipeline rules singleton. */
export const MEDIA_PIPELINE_SETTINGS_ID = 'global'

/**
 * Media pipeline settings — max W×H, JPEG/WebP quality, PNG-for-logos,
 * derivative sizes, and per-group decode/resize choice maps.
 * Document JSON is MediaPipelineRules (`src/core/media/pipeline.ts`).
 */
export const sfMediaSettings = pgTable('sf_media_settings', {
  id: text('id').primaryKey(),
  document: text('document').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

/**
 * Generic per-module settings documents (design-module-boundary M2).
 * Keyed by module id (`product:forms`, …). Packs own the JSON shape via
 * manifest `settings.schema`; Core only hosts load/save.
 * `sf_form_settings` lives with Forms (`src/modules/forms/schema.ts`).
 * `sf_media_settings` stays here because Core's media settings store reads it.
 * Do not dual-write module settings into that singleton.
 */
export const sfModuleSettings = pgTable('sf_module_settings', {
  /** Module manifest id (e.g. `product:consent`). */
  id: text('id').primaryKey(),
  /** Pack-defined settings document. */
  document: jsonb('document').$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

/**
 * Group-keyed admin ACL. One row per group and resource.
 * `level` is `none | view | edit | manage`. `allowed` stays true whenever
 * the level is not `none`, so older readers still see a grant.
 */
export const sfAclPermissions = pgTable(
  'sf_acl_permissions',
  {
    id: text('id').primaryKey(),
    groupId: text('group_id')
      .notNull()
      .references(() => sfUserGroups.id, { onDelete: 'cascade' }),
    /** Stable resource key, e.g. `admin.users`, `admin.nav`. */
    resource: text('resource').notNull(),
    /** `none`, `view`, `edit`, or `manage`. Manage includes edit and view. */
    level: text('level').default('none').notNull(),
    allowed: boolean('allowed').default(false).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_acl_permissions_group_resource_uidx').on(table.groupId, table.resource),
    index('sf_acl_permissions_group_id_idx').on(table.groupId),
  ],
)

/**
 * Append-only admin audit trail.
 * Who changed an account, a module toggle, a redirect, or the environment file.
 * No request body, no secrets, no update, no delete. Do not backfill.
 */
export const sfAdminAudit = pgTable(
  'sf_admin_audit',
  {
    id: text('id').primaryKey(),
    actorUserId: text('actor_user_id').notNull(),
    /** Stable action key, e.g. `user.disable`, `module.off`, `environment.save`. */
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sf_admin_audit_created_at_idx').on(table.createdAt),
    index('sf_admin_audit_actor_user_id_idx').on(table.actorUserId),
  ],
)
