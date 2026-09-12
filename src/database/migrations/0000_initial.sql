CREATE TYPE "public"."user_status" AS ENUM('active','inactive');
CREATE TABLE "users" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,"name" varchar(120) NOT NULL,"email" varchar(320) NOT NULL,"status" "user_status" DEFAULT 'active' NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"deleted_at" timestamp with time zone);
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");
CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");

