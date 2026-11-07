CREATE TABLE "sf_map_rooms" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"title" text DEFAULT 'Live map' NOT NULL,
	"owner_user_id" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_map_room_admins" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_map_teams" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"name" text DEFAULT 'Team' NOT NULL,
	"color" text DEFAULT '#3b82f6' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"ticket_tier_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_map_team_members" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_map_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"team_id" text NOT NULL,
	"user_id" text NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sf_map_positions" (
	"session_id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"team_id" text NOT NULL,
	"user_id" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"accuracy" double precision,
	"heading" double precision,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_map_overlays" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"kind" text DEFAULT 'point' NOT NULL,
	"point_kind" text DEFAULT 'poi' NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"media_id" text,
	"geojson" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sf_map_room_admins" ADD CONSTRAINT "sf_map_room_admins_room_id_sf_map_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."sf_map_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_map_teams" ADD CONSTRAINT "sf_map_teams_room_id_sf_map_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."sf_map_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_map_team_members" ADD CONSTRAINT "sf_map_team_members_team_id_sf_map_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."sf_map_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_map_sessions" ADD CONSTRAINT "sf_map_sessions_room_id_sf_map_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."sf_map_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_map_sessions" ADD CONSTRAINT "sf_map_sessions_team_id_sf_map_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."sf_map_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_map_positions" ADD CONSTRAINT "sf_map_positions_session_id_sf_map_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sf_map_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_map_overlays" ADD CONSTRAINT "sf_map_overlays_room_id_sf_map_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."sf_map_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sf_map_rooms_event_unique" ON "sf_map_rooms" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "sf_map_rooms_event_id_idx" ON "sf_map_rooms" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "sf_map_rooms_owner_idx" ON "sf_map_rooms" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_map_room_admins_room_user" ON "sf_map_room_admins" USING btree ("room_id","user_id");--> statement-breakpoint
CREATE INDEX "sf_map_room_admins_room_idx" ON "sf_map_room_admins" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "sf_map_teams_room_idx" ON "sf_map_teams" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "sf_map_teams_sort_idx" ON "sf_map_teams" USING btree ("room_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_map_team_members_team_user" ON "sf_map_team_members" USING btree ("team_id","user_id");--> statement-breakpoint
CREATE INDEX "sf_map_team_members_team_idx" ON "sf_map_team_members" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "sf_map_team_members_user_idx" ON "sf_map_team_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sf_map_sessions_room_idx" ON "sf_map_sessions" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "sf_map_sessions_user_idx" ON "sf_map_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sf_map_sessions_active_idx" ON "sf_map_sessions" USING btree ("room_id","user_id","left_at");--> statement-breakpoint
CREATE INDEX "sf_map_positions_team_idx" ON "sf_map_positions" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "sf_map_positions_room_idx" ON "sf_map_positions" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "sf_map_overlays_room_idx" ON "sf_map_overlays" USING btree ("room_id");
