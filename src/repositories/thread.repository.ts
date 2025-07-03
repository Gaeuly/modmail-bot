import { type DB } from "../database/db";
import { threads } from "../database/schema";
import { and, eq, isNull } from "drizzle-orm";
import { Thread } from "../models/thread.model";

// ThreadRepository (data access)
export class ThreadRepository {
  private db: DB;

  constructor(db: DB) {
    this.db = db;
  }

  async createThread(
    guildId: string,
    userId: string,
    channelId: string
  ): Promise<Thread> {
    const createdAt = new Date();
    const inserted = await this.db
      .insert(threads)
      .values({
        guildId,
        threadId: channelId,
        recipientId: userId,
        createdAt,
        closedAt: null,
        title: null,
      })
      .returning();

    return Thread.fromDatabaseRow(inserted[0]);
  }

  async getOpenThreadByUserID(userId: string): Promise<Thread | null> {
    const result = await this.db
      .select()
      .from(threads)
      // User match and thread is open
      // Thread open is just a check for closedAt being null
      .where(and(eq(threads.recipientId, userId), isNull(threads.closedAt)))
      .limit(1)
      .execute();

    if (result.length === 0) {
      return null;
    }

    const thread = result[0];

    return Thread.fromDatabaseRow(thread);
  }

  async getThreadByChannelId(channelId: string): Promise<Thread | null> {
    const result = await this.db
      .select()
      .from(threads)
      .where(eq(threads.threadId, channelId))
      .execute();

    if (result.length === 0) {
      return null;
    }

    const thread = result[0];

    return Thread.fromDatabaseRow(thread);
  }

  async closeThread(channelId: string, userId: string): Promise<void> {
    await this.db
      .update(threads)
      .set({ closedAt: new Date(), closedBy: userId })
      .where(eq(threads.threadId, channelId));
  }

  /**
   * Get all threads created by a specific user
   * @param userId The Discord user ID
   * @returns Array of threads created by the user
   */
  async getAllThreadsByUserId(userId: string): Promise<Thread[]> {
    // Assuming there's a database connection and threads table
    // This query should get all threads for the specified user, ordered by creation date
    const result = await this.db
      .select()
      .from(threads)
      .where(eq(threads.recipientId, userId))
      .orderBy(threads.createdAt)
      .execute();

    return result.map(Thread.fromDatabaseRow);
  }
}
