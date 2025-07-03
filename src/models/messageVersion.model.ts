// MessageVersion class represents a single edit/version of a message
export class MessageVersion {
  public readonly messageId: string;
  public readonly version: number;
  public readonly content: string;
  public readonly editedAt: Date;

  constructor(
    messageId: string,
    version: number,
    content: string,
    editedAt: Date
  ) {
    this.messageId = messageId;
    this.version = version;
    this.content = content;
    this.editedAt = editedAt;
  }

  static fromDatabaseRow(row: {
    messageId: string;
    version: number;
    content: string;
    editedAt: number | Date;
  }): MessageVersion {
    return new MessageVersion(
      row.messageId,
      row.version,
      row.content,
      typeof row.editedAt === "number" ? new Date(row.editedAt) : row.editedAt
    );
  }
}
