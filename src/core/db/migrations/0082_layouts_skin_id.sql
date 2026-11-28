-- sf_layouts.skin_id ships in the Drizzle schema. Add it on migrate
-- (idempotent for databases that already received the column).
ALTER TABLE "sf_layouts" ADD COLUMN IF NOT EXISTS "skin_id" text;
