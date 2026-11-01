import { boolean, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

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
   * When true, this core user may open Payload `/admin` via the Better Auth
   * session strategy (linked CMS stub). Global admins get this by default.
   */
  cmsAccess: boolean('cms_access').default(false).notNull(),
  banned: boolean('banned').default(false).notNull(),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

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
    /**
     * Better Auth admin plugin field (required once the plugin is enabled).
     * Column: `impersonated_by`. Apply with `npm run db:core:push` after pull.
     */
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
 * `label` is the admin display name. Seed row `default` is the Base Outline.
 * Empty/missing document → fall back to `src/core/modules/default-layout.json`.
 */
export const sfLayouts = pgTable('sf_layouts', {
  id: text('id').primaryKey(),
  /** Human display name (Outlines manager / Page Settings dropdown). */
  label: text('label').notNull().default('Untitled'),
  /** Canonical layout document JSON (version 3). */
  document: text('document').notNull(),
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
