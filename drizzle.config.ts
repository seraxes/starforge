import { defineConfig } from 'drizzle-kit'
import 'dotenv/config'

/**
 * Drizzle Kit manages Starforge core tables only (public schema).
 * Payload owns the payload schema — do not point this config at it.
 *
 * Module packs may add schema.ts under src/modules (sf_<id>_* tables);
 * include them in the schema glob so db:core:generate / migrate stay one pipeline.
 */
export default defineConfig({
  schema: ['./src/core/db/schema.ts', './src/modules/*/schema.ts'],
  out: './src/core/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://starforge:starforge@127.0.0.1:5432/starforge',
  },
  schemaFilter: ['public'],
})
