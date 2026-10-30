import { defineConfig } from 'drizzle-kit'
import 'dotenv/config'

/**
 * Drizzle Kit manages Starforge *core* tables only (public schema).
 * Payload owns the `payload` schema — do not point this config at it.
 */
export default defineConfig({
  schema: './src/core/db/schema.ts',
  out: './src/core/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://starforge:starforge@127.0.0.1:5432/starforge',
  },
  schemaFilter: ['public'],
})
