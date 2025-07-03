CREATE TABLE `messages` (
	`thread_id` text NOT NULL,
	`message_id` text PRIMARY KEY NOT NULL,
	`author_id` text NOT NULL,
	`is_staff` integer NOT NULL,
	`staff_relayed_message_id` text,
	`user_dm_message_id` text,
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`thread_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "thread_id_check" CHECK("messages"."thread_id" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "message_id_check" CHECK("messages"."message_id" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "author_id_check" CHECK("messages"."author_id" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "dm_message_id_check" CHECK("messages"."staff_relayed_message_id" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "user_dm_message_id_check" CHECK("messages"."user_dm_message_id" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "message_type_check" CHECK(("messages"."is_staff" = 1 AND "messages"."staff_relayed_message_id" IS NOT NULL AND "messages"."user_dm_message_id" IS NULL)
          OR
          ("messages"."is_staff" = 0 AND "messages"."user_dm_message_id" IS NOT NULL AND "messages"."staff_relayed_message_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE `config` (
	`guild_id` text PRIMARY KEY NOT NULL,
	`open_tag_id` text,
	CONSTRAINT "guild_id_check" CHECK("config"."guild_id" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "open_tag_id_check" CHECK("config"."open_tag_id" NOT GLOB '*[^0-9]*')
);
--> statement-breakpoint
CREATE TABLE `snippets` (
	`guild_id` text NOT NULL,
	`name` text NOT NULL,
	`content` text NOT NULL,
	CONSTRAINT "guild_id_check" CHECK("snippets"."guild_id" NOT GLOB '*[^0-9]*')
);
--> statement-breakpoint
CREATE TABLE `threads` (
	`guild_id` text NOT NULL,
	`thread_id` text PRIMARY KEY NOT NULL,
	`recipient_id` text NOT NULL,
	`title` text,
	`created_at` integer DEFAULT '"2025-03-28T02:44:24.940Z"' NOT NULL,
	`closed_at` integer,
	`closed_by` text,
	CONSTRAINT "guild_id_check" CHECK("threads"."guild_id" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "thread_id_check" CHECK("threads"."thread_id" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "recipient_id_check" CHECK("threads"."recipient_id" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "closedby_id_check" CHECK("threads"."closed_by" NOT GLOB '*[^0-9]*')
);
