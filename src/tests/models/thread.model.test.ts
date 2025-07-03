import { describe, it, expect } from "bun:test";
import { Thread } from "../../models/thread.model";
import { randomSnowflakeID } from "tests/utils/snowflake";

describe("Thread", () => {
  describe("isOpen", () => {
    it("should return true when closedAt is null", () => {
      const thread = new Thread(
        randomSnowflakeID(),
        randomSnowflakeID(),
        randomSnowflakeID(),
        null,
        new Date(),
        null
      );
      expect(thread.isOpen).toBe(true);
    });

    it("should return false when closedAt is not null", () => {
      const thread = new Thread(
        randomSnowflakeID(),
        randomSnowflakeID(),
        randomSnowflakeID(),
        null,
        new Date(),
        new Date()
      );
      expect(thread.isOpen).toBe(false);
    });
  });

  describe("isClosed", () => {
    it("should return false when closedAt is null", () => {
      const thread = new Thread(
        randomSnowflakeID(),
        randomSnowflakeID(),
        randomSnowflakeID(),
        null,
        new Date(),
        null
      );
      expect(thread.isClosed).toBe(false);
    });

    it("should return true when closedAt is not null", () => {
      const thread = new Thread(
        randomSnowflakeID(),
        randomSnowflakeID(),
        randomSnowflakeID(),
        null,
        new Date(),
        new Date()
      );
      expect(thread.isClosed).toBe(true);
    });
  });

  describe("link", () => {
    it("should return the correct Discord channel URL", () => {
      const guildId = randomSnowflakeID();
      const channelId = randomSnowflakeID();

      const thread = new Thread(
        guildId,
        channelId,
        randomSnowflakeID(),
        null,
        new Date(),
        null
      );

      expect(thread.link).toBe(
        `https://discord.com/channels/${guildId}/${channelId}`
      );
    });

    it("should update the link when guildId or channelId changes", () => {
      const guildId = randomSnowflakeID();
      const channelId = randomSnowflakeID();

      const thread = new Thread(
        guildId,
        channelId,
        randomSnowflakeID(),
        null,
        new Date(),
        null
      );

      expect(thread.link).toBe(
        `https://discord.com/channels/${guildId}/${channelId}`
      );

      // Update the IDs
      thread.guildId = randomSnowflakeID();
      thread.channelId = randomSnowflakeID();

      // Check that the link reflects the new IDs
      expect(thread.link).toBe(
        `https://discord.com/channels/${thread.guildId}/${thread.channelId}`
      );
    });
  });
});
