import type { threads } from "database/schema";

// Thread model (data structure)
export class Thread {
  public guildId: string;
  public channelId: string;
  public userId: string;
  public title: string | null;
  public createdAt: Date;
  public closedAt: Date | null;
  public closedBy: string | null;

  constructor(
    guildId: string,
    channelId: string,
    userId: string,
    title: string | null = null,
    createdAt: Date,
    closedAt: Date | null = null,
    closedBy: string | null = null
  ) {
    this.guildId = guildId;
    this.channelId = channelId;
    this.userId = userId;
    this.title = title;
    this.createdAt = createdAt;
    this.closedAt = closedAt;
    this.closedBy = closedBy;
  }

  static fromDatabaseRow(row: typeof threads.$inferSelect): Thread {
    return new Thread(
      row.guildId,
      row.threadId,
      row.recipientId,
      row.title,
      row.createdAt,
      row.closedAt,
      row.closedBy
    );
  }

  get isOpen(): boolean {
    return this.closedAt === null;
  }

  get isClosed(): boolean {
    return this.closedAt !== null;
  }

  get link(): string {
    return `https://discord.com/channels/${this.guildId}/${this.channelId}`;
  }

  get originalMessageLink(): string {
    return `https://discord.com/channels/${this.guildId}/${this.channelId}/${this.channelId}`;
  }

  public toString(): string {
    const timestampS = this.createdAt.getTime() / 1000;
    const timestamp = `<t:${timestampS}:D>`;

    const url = `https://discord.com/channels/${this.guildId}/${this.channelId}`;

    let s = `${timestamp} - ${url}`;

    if (this.isClosed) {
      s += ` (Closed by <@${this.closedBy}>)`;
    }

    return s;
  }
}
