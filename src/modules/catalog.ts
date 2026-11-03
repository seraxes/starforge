/**
 * @deprecated Import `ensureModulesRegistered` from `@/core/modules/boot` (or `@/core/modules`).
 * Kept as a thin re-export so older call sites keep working during the SF-141 migration.
 */

export {
  ensureModulesRegistered,
  resetModulesRegistrationForTests,
} from '@/core/modules/boot'
