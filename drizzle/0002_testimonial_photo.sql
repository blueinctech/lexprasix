ALTER TABLE "testimonials" ADD COLUMN "photo_src" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "testimonials" ADD COLUMN "rating" integer DEFAULT 5 NOT NULL;