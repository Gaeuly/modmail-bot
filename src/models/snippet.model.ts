import type { snippets } from "../database/schema";

// Snippet model (data structure)
export class Snippet {
  public guildId: string;
  public name: string;
  public content: string;

  constructor(guildId: string, name: string, content: string) {
    this.guildId = guildId;
    this.name = name;
    this.content = content;
  }

  static fromDatabaseRow(row: typeof snippets.$inferSelect): Snippet {
    return new Snippet(row.guildId, row.name, row.content);
  }

  public toString(): string {
    return this.content;
  }
}
