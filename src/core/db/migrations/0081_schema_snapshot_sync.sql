-- Snapshot sync only. Tables for ads/documents/onboarding/marketplace/social
-- already ship in 0058–0080. This file exists so meta/0081_snapshot.json matches
-- the TypeScript schema and `drizzle-kit generate` stays empty in CI.
SELECT 1;
