import { Thread } from "models/thread.model";
import { randomSnowflakeID } from "tests/utils/snowflake";

export function mockThread(options?: {
  userId?: string;
  closed?: boolean;
}): Thread {
  const t = Thread.fromDatabaseRow({
    guildId: randomSnowflakeID(),
    threadId: randomSnowflakeID(),
    recipientId: randomSnowflakeID(),
    title: null,
    createdAt: new Date(),
    closedAt: null,
    closedBy: null,
  });

  if (options?.userId) {
    t.userId = options?.userId;
  }

  if (options?.closed) {
    t.closedAt = new Date();
    t.closedBy = randomSnowflakeID();
  }

  return t;
}
