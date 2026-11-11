ALTER TABLE "posts" ALTER COLUMN "comments_open" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "author_email" text;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "ip_hash" text;--> statement-breakpoint
-- Comments open on existing articles too (the new comment form replaces WordPress comments).
UPDATE "posts" SET "comments_open" = true;