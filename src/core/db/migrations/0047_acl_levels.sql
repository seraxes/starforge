ALTER TABLE "sf_acl_permissions" ADD COLUMN "level" text DEFAULT 'none' NOT NULL;
--> statement-breakpoint
UPDATE "sf_acl_permissions" SET "level" = 'manage' WHERE "allowed" = true;
--> statement-breakpoint
UPDATE "sf_acl_permissions" SET "level" = 'none' WHERE "allowed" = false;
