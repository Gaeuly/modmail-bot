PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_message_versions` (
	`message_id` text NOT NULL,
	`version` integer NOT NULL,
	`content` text NOT NULL,
	`edited_at` integer DEFAULT (strftime('%s','now')) NOT NULL,
	PRIMARY KEY(`message_id`, `version`),
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`message_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_message_versions`("message_id", "version", "content", "edited_at") SELECT "message_id", "version", "content", "edited_at" FROM `message_versions`;--> statement-breakpoint
DROP TABLE `message_versions`;--> statement-breakpoint
ALTER TABLE `__new_message_versions` RENAME TO `message_versions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_threads` (
	`guild_id` text NOT NULL,
	`thread_id` text PRIMARY KEY NOT NULL,
	`recipient_id` text NOT NULL,
	`title` text,
	`created_at` integer DEFAULT '"2025-05-21T15:53:28.113Z"' NOT NULL,
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
ALTER TABLE `__new_threads` RENAME TO `threads`;