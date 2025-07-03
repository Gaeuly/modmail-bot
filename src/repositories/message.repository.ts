import { type DB } from "../database/db";
import { additionalMessageIds, messages } from "../database/schema";
import { asc, desc, eq, sql } from "drizzle-orm";
import { Message, type MessageSticker } from "../models/message.model";
import { getLogger } from "utils/logger";
import { messageEdits } from "../database/schema";
import { MessageVersion } from "../models/messageVersion.model";
import { version } from "bun";

export type NewMessage = {
  messageId: string;
  threadId: string;
  authorId: string;
  isStaff: boolean;
  staffRelayedMessageId?: string | null;
  userDmMessageId?: string | null;
  content?: string | null;
  isAnonymous?: boolean | null;
  isPlainText?: boolean | null;
  isSnippet?: boolean | null;
  attachmentUrls: string[];
  stickers: MessageSticker[];
};

export class MessageRepository {
  private db: DB;

  private logger = getLogger(this.constructor.name);

  constructor(db: DB) {
    this.db = db;
  }

  async saveMessage(msg: NewMessage): Promise<Message> {
    this.logger.debug({ msg }, "Creating message");

    const inserted = await this.db
      .insert(messages)
      .values({
        messageId: msg.messageId,
        threadId: msg.threadId,
        authorId: msg.authorId,
        isStaff: msg.isStaff,
        staffRelayedMessageId: msg.staffRelayedMessageId || null,
        userDmMessageId: msg.userDmMessageId || null,
        // Do not use || null or it'll make falsey values null
        content: msg.content,
        isAnonymous: msg.isAnonymous,
        isPlainText: msg.isPlainText,
        isSnippet: msg.isSnippet,
        attachmentUrls: JSON.stringify(msg.attachmentUrls),
        stickers: JSON.stringify(msg.stickers),
      })
      .returning();

    return Message.fromDatabaseRow(inserted[0]);
  }

  async deleteMessage(messageId: string): Promise<void> {
    this.logger.debug({ messageId }, "Marking message as deleted");

    // Doesn't actually delete, just marks it as deleted since we still want to
    // track it
    await this.db
      .update(messages)
      .set({
        isDeleted: true,
      })
      .where(eq(messages.messageId, messageId))
      .execute();
  }

  /**
   * Get a message by the message ID of a bot message in a staff thread.
   * E.g. From the bot's message in a modmail thread:
   * If it's a staff message -> Get the forwarded message ID
   * If it's a user's message -> Get the original user's DM message ID
   *
   * @param messageId
   * @returns
   */
  async getByThreadMessageId(messageId: string): Promise<Message | null> {
    const result = await this.db
      .select()
      .from(messages)
      .where(eq(messages.messageId, messageId))
      .limit(1)
      .execute();

    if (result.length === 0) {
      return null;
    }

    return Message.fromDatabaseRow(result[0]);
  }

  /**
   * Get additional message IDs for a message in a thread. This is used for
   * splitting up a single message into multiple messages in a thread when it
   * exceeds the maximum message length, likely due to many edits to a long
   * user message.
   *
   * @param messageId
   * @returns
   */
  async getAdditionalMessageIds(messageId: string): Promise<string[]> {
    const result = await this.db
      .select()
      .from(additionalMessageIds)
      .where(eq(additionalMessageIds.mainMessageId, messageId))
      // Old to new... as we sort from top to bottom when creating messages.
      // Newer have larger IDs
      .orderBy(
        asc(sql`cast(${additionalMessageIds.additionalMessageId} as integer)`)
      )
      .execute();

    return result.map((row) => row.additionalMessageId);
  }

  async saveAdditionalMessageId(
    mainMessageId: string,
    additionalMessageId: string
  ): Promise<void> {
    this.logger.debug(
      { mainMessageId, additionalMessageId },
      "Saving additional message ID"
    );

    await this.db
      .insert(additionalMessageIds)
      .values({
        mainMessageId,
        additionalMessageId,
      })
      .onConflictDoNothing()
      .execute();
  }

  /**
   * Get a message by the message ID of the staff relayed message.
   * Staff's message sent to DMs -> Get the message in the staff thread
   *
   * @param dmMessageId
   * @returns
   */
  async getByStaffDMMessageId(dmMessageId: string): Promise<Message | null> {
    const result = await this.db
      .select()
      .from(messages)
      .where(eq(messages.staffRelayedMessageId, dmMessageId))
      .limit(1)
      .execute();

    if (result.length === 0) {
      return null;
    }

    return Message.fromDatabaseRow(result[0]);
  }

  /**
   *  Get a message by the message ID of the original user's DM message.
   * E.g. From user original DM -> Get relayed message in staff thread
   *
   * @param dmMessageId
   * @returns
   */
  async getByUserDMMessageId(dmMessageId: string): Promise<Message | null> {
    const result = await this.db
      .select()
      .from(messages)
      .where(eq(messages.userDmMessageId, dmMessageId))
      .limit(1)
      .execute();

    if (result.length === 0) {
      return null;
    }

    return Message.fromDatabaseRow(result[0]);
  }

  async saveNewMessageVersion(
    messageId: string,
    newContent: string
  ): Promise<void> {
    this.logger.debug(
      { messageId, content: newContent },
      "Saving new message version"
    );

    await this.db.transaction(async (tx) => {
      // Max + 1 of the current messageId, or 1 if none exist.
      // Note: Using SQLITE, so in transactions this is safe such that there
      // won't be any concurrent transactions trying to get or modify the same
      // messageId.
      const nextVersion = await tx
        .select({
          version: sql<number>`coalesce(max(version), 0) + 1`,
        })
        .from(messageEdits)
        .where(eq(messageEdits.messageId, messageId))
        .execute();

      const previousMessage = await tx
        .select({ content: messages.content })
        .from(messages)
        .where(eq(messages.messageId, messageId))
        .limit(1)
        .execute();

      // Ignore empty strings
      if (previousMessage.length === 0 || !previousMessage[0].content) {
        this.logger.error(
          { messageId },
          "Failed to get previous message content"
        );

        // No message content found, and no db mutations were made. So we can
        // just return instead of rolling back. drizzle tx.rollback() will throw
        // an error which isn't ideal for this. Not an error.
        return;
      }

      this.logger.debug(
        {
          messageId,
          version: nextVersion[0].version,
          oldContent: previousMessage[0].content,
          newContent: newContent,
        },
        "Moving previous message content to message versions"
      );

      // 1. Move the current message content to the message versions table
      await tx
        .insert(messageEdits)
        .values({
          messageId: messageId,
          version: nextVersion[0].version,
          content: previousMessage[0].content,
          editedAt: new Date(),
        })
        .execute();

      // 2. Update the current message with the new content
      await tx
        .update(messages)
        .set({
          content: newContent,
        })
        .where(eq(messages.messageId, messageId))
        .execute();
    });
  }

  /**
   * Get all versions of a message, ordered by newest to oldest.
   * @param messageId
   */
  async getMessageVersions(messageId: string): Promise<MessageVersion[]> {
    const rows = await this.db
      .select()
      .from(messageEdits)
      .where(eq(messageEdits.messageId, messageId))
      .orderBy(desc(messageEdits.version))
      .execute();

    return rows.map(MessageVersion.fromDatabaseRow);
  }
}
