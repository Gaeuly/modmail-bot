CREATE TABLE `message_versions` (
	`message_id` text NOT NULL,
	`version` integer NOT NULL,
	`content` text NOT NULL,
	`edited_at` integer DEFAULT '"2025-05-18T22:03:13.441Z"' NOT NULL,
	PRIMARY KEY(`message_id`, `version`),
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`message_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_threads` (
	`guild_id` text NOT NULL,
	`thread_id` text PRIMARY KEY NOT NULL,
	`recipient_id` text NOT NULL,
	`title` text,
	`created_at` integer DEFAULT '"2025-05-18T22:03:13.440Z"' NOT NULL,
	`closed_at` integer,
	`closed_by` text,
	CONSTRAINT "guild_id_check" CHECK("__new_threads"."guild_id" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "thread_id_check" CHECK("__new_threads"."thread_id" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "recipient_id_check" CHECK("__new_threads"."recipient_id" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "closedby_id_check" CHECK("__new_threads"."closed_by" IS NULL OR "__new_threads"."closed_by" NOT GLOB '*[^0-9]*')
);
--> statement-breakpoint
INSERT INTO `__new_threads`("guild_id", "thread_id", "recipient_id", "title", "created_at", "closed_at", "closed_by") SELECT "guild_id", "thread_id", "recipient_id", "title", "created_at", "closed_at", "closed_by" FROM `threads`;--> statement-breakpoint
DROP TABLE `threads`;--> statement-breakpoint
ALTER TABLE `__new_threads` RENAME TO `threads`;--> statement-breakpoint
PRAGMA foreign_keys=ON;