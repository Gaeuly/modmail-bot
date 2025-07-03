import { type DB } from "../database/db";
import { snippets } from "../database/schema";
import { and, eq } from "drizzle-orm";
import { Snippet } from "../models/snippet.model";

export class SnippetRepository {
  private db: DB;

  constructor(db: DB) {
    this.db = db;
  }

  async getSnippet(guildId: string, name: string): Promise<Snippet | null> {
    const result = await this.db
      .select()
      .from(snippets)
      .where(and(eq(snippets.guildId, guildId), eq(snippets.name, name)))
      .limit(1)
      .execute();

    if (result.length === 0) {
      return null;
    }

    return Snippet.fromDatabaseRow(result[0]);
  }

  async getAllSnippets(guildId: string): Promise<Snippet[]> {
    const result = await this.db
      .select()
      .from(snippets)
      .where(eq(snippets.guildId, guildId))
      .execute();

    return result.map(Snippet.fromDatabaseRow);
  }

  async createSnippet(
    guildId: string,
    name: string,
    content: string
  ): Promise<Snippet> {
    const inserted = await this.db
      .insert(snippets)
      .values({
        guildId,
        name,
        content,
      })
      .returning();

    return Snippet.fromDatabaseRow(inserted[0]);
  }

  async updateSnippet(
    guildId: string,
    name: string,
    content: string
  ): Promise<Snippet> {
    const updated = await this.db
      .update(snippets)
      .set({
        content,
      })
      .where(and(eq(snippets.guildId, guildId), eq(snippets.name, name)))
      .returning();

    return Snippet.fromDatabaseRow(updated[0]);
  }

  async deleteSnippet(guildId: string, name: string): Promise<boolean> {
    const deleted = await this.db
      .delete(snippets)
      .where(and(eq(snippets.guildId, guildId), eq(snippets.name, name)))
      .returning();

    return deleted.length > 0;
  }
}
