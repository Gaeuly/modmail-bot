PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_messages` (
	`thread_id` text NOT NULL,
	`message_id` text PRIMARY KEY NOT NULL,
	`author_id` text NOT NULL,
	`is_staff` integer NOT NULL,
	`staff_relayed_message_id` text,
	`user_dm_message_id` text,
	`content` text,
	`is_anonymous` integer,
	`is_plain_text` integer,
	`is_snippet` integer,
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`thread_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "thread_id_check" CHECK("__new_messages"."thread_id" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "message_id_check" CHECK("__new_messages"."message_id" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "author_id_check" CHECK("__new_messages"."author_id" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "dm_message_id_check" CHECK("__new_messages"."staff_relayed_message_id" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "user_dm_message_id_check" CHECK("__new_messages"."user_dm_message_id" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "message_type_check" CHECK((
            "__new_messages"."is_staff" = 1
            AND "__new_messages"."staff_relayed_message_id" IS NOT NULL
            AND "__new_messages"."user_dm_message_id" IS NULL)
          OR
          (
            "__new_messages"."is_staff" = 0
            AND "__new_messages"."user_dm_message_id" IS NOT NULL
            AND "__new_messages"."staff_relayed_message_id" IS NULL
          )),
	CONSTRAINT "staff_metadata_check" CHECK(
        "__new_messages"."is_staff" = 0
        OR
        (
          "__new_messages"."is_staff" = 1
          AND "__new_messages"."content" IS NOT NULL
          AND "__new_messages"."is_anonymous" IS NOT NULL
          AND "__new_messages"."is_plain_text" IS NOT NULL
          AND "__new_messages"."is_snippet" IS NOT NULL
        ))
);
--> statement-breakpoint
INSERT INTO `__new_messages`("thread_id", "message_id", "author_id", "is_staff", "staff_relayed_message_id", "user_dm_message_id", "content", "is_anonymous", "is_plain_text", "is_snippet") SELECT "thread_id", "message_id", "author_id", "is_staff", "staff_relayed_message_id", "user_dm_message_id", "content", "is_anonymous", "is_plain_text", "is_snippet" FROM `messages`;--> statement-breakpoint
DROP TABLE `messages`;--> statement-breakpoint
ALTER TABLE `__new_messages` RENAME TO `messages`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_threads` (
	`guild_id` text NOT NULL,
	`thread_id` text PRIMARY KEY NOT NULL,
	`recipient_id` text NOT NULL,
	`title` text,
	`created_at` integer DEFAULT '"2025-04-02T00:42:37.357Z"' NOT NULL,
	`closed_at` integer,
	`closed_by` text,
	CONSTRAINT "guild_id_check" CHECK("__new_threads"."guild_id" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "thread_id_check" CHECK("__new_threads"."thread_id" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "recipient_id_check" CHECK("__new_threads"."recipient_id" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "closedby_id_check" CHECK("__new_threads"."closed_by" NOT GLOB '*[^0-9]*')
);
--> statement-breakpoint
INSERT INTO `__new_threads`("guild_id", "thread_id", "recipient_id", "title", "created_at", "closed_at", "closed_by") SELECT "guild_id", "thread_id", "recipient_id", "title", "created_at", "closed_at", "closed_by" FROM `threads`;--> statement-breakpoint
DROP TABLE `threads`;--> statement-breakpoint
ALTER TABLE `__new_threads` RENAME TO `threads`;