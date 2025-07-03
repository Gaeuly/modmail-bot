import { describe, it, expect, beforeEach } from "bun:test";
import { getDb } from "../../database/db";
import { ThreadRepository } from "../../repositories/thread.repository";
import { Thread } from "../../models/thread.model";

describe("ThreadRepository", () => {
  let db: ReturnType<typeof getDb>;
  let threadRepository: ThreadRepository;

  beforeEach(() => {
    db = getDb(":memory:");
    threadRepository = new ThreadRepository(db);
  });

  describe("createThread", () => {
    it("should not accept non-digit IDs", async () => {
      const guildId = "guild";
      const userId = "user";
      const channelId = "channel";

      expect(
        threadRepository.createThread(guildId, userId, channelId)
      ).rejects.toThrow(/CHECK constraint failed: guild_id_check/);
    });

    it("should insert a new thread into the database", async () => {
      const guildId = "123";
      const userId = "456";
      const channelId = "789";

      await threadRepository.createThread(guildId, userId, channelId);

      const result = await threadRepository.getThreadByChannelId(channelId);
      expect(result).toEqual(
        new Thread(
          guildId,
          channelId,
          userId,
          null,
          expect.any(Date),
          null,
          null
        )
      );
    });
  });

  describe("getThreadByChannelId", () => {
    it("should return the thread with the given channelId", async () => {
      const guildId = "123";
      const userId = "456";
      const channelId = "789";

      await threadRepository.createThread(guildId, userId, channelId);

      const result = await threadRepository.getThreadByChannelId(channelId);

      expect(result).toEqual(
        new Thread(
          guildId,
          channelId,
          userId,
          null,
          expect.any(Date),
          null,
          null
        )
      );
    });
  });

  describe("closeThread", () => {
    it("should set closedAt to the current date", async () => {
      const guildId = "123";
      const userId = "456";
      const channelId = "789";

      const closerUserID = "987";

      await threadRepository.createThread(guildId, userId, channelId);
      await threadRepository.closeThread(channelId, closerUserID);

      const result = await threadRepository.getThreadByChannelId(channelId);

      expect(result).not.toBeNull();
      expect(result!.isOpen).toBe(false);
      expect(result!.closedAt).toEqual(expect.any(Date));
    });

    it("should be noop if the thread does not exist", async () => {
      const channelId = "nonexistent";
      const closerUserID = "987";

      await threadRepository.closeThread(channelId, closerUserID);
    });
  });

  describe("getOpenThreadByUserID", () => {
    it("should return the open thread for the given userId", async () => {
      const guildId = "123";
      const userId = "456";
      const channelId = "789";

      await threadRepository.createThread(guildId, userId, channelId);

      const result = await threadRepository.getOpenThreadByUserID(userId);

      expect(result).toEqual(
        new Thread(
          guildId,
          channelId,
          userId,
          null,
          expect.any(Date),
          null,
          null
        )
      );
    });

    it("should return null if there is no open thread for the given userId", async () => {
      const userId = "nonexistent";

      const result = await threadRepository.getOpenThreadByUserID(userId);

      expect(result).toBeNull();
    });

    it("should return null if the thread for the given userId is closed", async () => {
      const guildId = "123";
      const userId = "456";
      const channelId = "789";

      const closerUserID = "987";

      await threadRepository.createThread(guildId, userId, channelId);
      await threadRepository.closeThread(channelId, closerUserID);

      const result = await threadRepository.getOpenThreadByUserID(userId);

      expect(result).toBeNull();
    });
  });
});
