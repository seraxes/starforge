-- Phase 4: drop the unused Payload schema after the idempotent sf_* copy.
-- scripts/db-migrate.mts runs this file AFTER that copy.
-- It is not in the Drizzle journal, so `db:core:migrate` cannot drop payload.* first.
-- Safe to re-run. Does not touch public.sf_* tables.
DROP SCHEMA IF EXISTS payload CASCADE;
