import type { botEmojis } from "database/schema";
import { z } from "zod";

export const BotEmojiNameSchema = z.enum([
  "delete",
  "edit",
  "logs",
  "message_id",
  "message_reply",
  "message",
  "plain_text",
  "settings",
  "snippet",
  "staff_user",
  "prefix",
  "channel",
  "arrow_down_right",
  "user",
  "forward",
  "silent",
  "notify",
  "heart",
  "clock",
]);

export type BotEmojiName = z.infer<typeof BotEmojiNameSchema>;

/**
 * Emoji mapping keyed by either a single BotEmojiName or an array of BotEmojiNames.
 * Allows passing a const tuple of names directly for convenience: MessageEmojis<typeof NamesTuple>.
 */
export type MessageEmojiMap<T extends readonly BotEmojiName[] | BotEmojiName> =
  {
    [K in T extends readonly BotEmojiName[] ? T[number] : T]: string;
  };

export class BotEmoji {
  public readonly name: BotEmojiName;
  public readonly id: string;
  public readonly sha256: string;

  constructor(name: BotEmojiName, id: string, sha256: string) {
    this.name = name;
    this.id = id;
    this.sha256 = sha256;
  }

  static fromDatabaseRow(row: typeof botEmojis.$inferSelect): BotEmoji {
    const name = BotEmojiNameSchema.safeParse(row.name);

    if (!name.success) {
      throw new Error(
        `Invalid emoji name ${row.name} for emoji ${row.id}, does not match enum`
      );
    }

    return new BotEmoji(name.data, row.id, row.sha256);
  }

  toEmojiString(): string {
    return `<:${this.name}:${this.id}>`;
  }
}
