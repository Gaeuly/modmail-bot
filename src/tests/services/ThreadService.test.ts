import {
  Client,
  ChannelType,
  TextChannel,
  ThreadChannel,
  SnowflakeUtil,
  ForumChannel,
  type ForumThreadChannel,
  Guild,
  User,
  type GuildForumTag,
  Collection,
  DiscordAPIError,
  RESTJSONErrorCodes,
  type Snowflake,
} from "discord.js";
import { ThreadService } from "../../services/ThreadService";
import { ThreadRepository } from "../../repositories/thread.repository";
import { Thread } from "../../models/thread.model";
import { StaffThreadView } from "../../views/StaffThreadView";
import { getLogger } from "utils/logger";
import type { BotEmojiRepository } from "repositories/botEmoji.repository";

import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { getDb } from "database/db";
import { randomSnowflakeID } from "tests/utils/snowflake";
import { mockThread } from "tests/models/thread.model.mock.test";
import type { BotConfig } from "models/botConfig.model";
import type { RuntimeConfig } from "models/runtimeConfig.model";
import * as mutualServersUtil from "utils/mutualServers";

// Mock dependencies
const mockThreadRepository = {
  getOpenThreadByUserID: mock(),
  getThreadByChannelId: mock(),
  getAllThreadsByUserId: mock(),
  createThread: mock(),
  closeThread: mock(),
};

const mockRuntimeConfigRepository = {
  getConfig: mock(),
  setConfig: mock(),
};

const mockEmojiRepository = {
  logger: { info: mock(), error: mock(), debug: mock(), warn: mock() },
  getEmoji: mock(),
  getEmojis: mock(),
  saveEmoji: mock(),
  getEmojiMap: mock(),
};

describe("ThreadService", () => {
  let client: Client;
  let threadService: ThreadService;
  let config: BotConfig;

  let guildMock: Guild;

  beforeEach(() => {
    config = {
      guildId: randomSnowflakeID(),
    } as unknown as BotConfig;

    client = {
      channels: {
        fetch: mock(),
      },
      guilds: {
        cache: {
          get: mock(),
          values: mock(() => []),
        },
      },
      users: {
        fetch: mock(),
      },
    } as unknown as Client;

    guildMock = {
      members: {
        fetch: mock(() => Promise.resolve(123)),
      },
    } as unknown as Guild;

    threadService = new ThreadService(
      config,
      client,
      mockRuntimeConfigRepository,
      mockThreadRepository,
      mockEmojiRepository as unknown as BotEmojiRepository
    );
  });

  describe("getOpenTagId", () => {
    it("should return the open tag ID from runtime config", async () => {
      const runtimeConfig = {
        openTagId: "openTagId123",
        forumChannelId: randomSnowflakeID(),
      } as RuntimeConfig;

      const mockForumChannel = {
        type: ChannelType.GuildForum,
        availableTags: [{ name: "Open", id: "openTagId123" }],
      } as unknown as ForumChannel;

      mockRuntimeConfigRepository.getConfig.mockResolvedValue(runtimeConfig);
      spyOn(client.channels, "fetch").mockResolvedValue(mockForumChannel);

      const result = await threadService.getOpenTagId();

      expect(result).toBe("openTagId123");
      expect(mockRuntimeConfigRepository.getConfig).toHaveBeenCalledWith(
        config.guildId
      );
    });

    it("should throw if forumChannelId is not set in runtime config", async () => {
      const runtimeConfig = {
        openTagId: null,
        forumChannelId: null,
      } as RuntimeConfig;

      mockRuntimeConfigRepository.getConfig.mockResolvedValue(runtimeConfig);

      await expect(threadService.getOpenTagId()).rejects.toThrow(
        `Not initialized yet: Forum channel ID not set in runtime config: ${config.guildId}`
      );
    });

    it("should create a new Open tag if none exists", async () => {
      const forumChannelId = randomSnowflakeID();
      const newTagId = randomSnowflakeID();
      const runtimeConfig = {
        openTagId: null,
        forumChannelId,
      } as RuntimeConfig;

      mockRuntimeConfigRepository.getConfig.mockResolvedValue(runtimeConfig);

      // Mock forum channel with no existing Open tag
      const mockForumChannel = {
        type: ChannelType.GuildForum,
        availableTags: [],
        setAvailableTags: mock().mockResolvedValue({
          availableTags: [{ name: "Open", id: newTagId }],
        }),
      } as unknown as ForumChannel;

      spyOn(client.channels, "fetch").mockResolvedValue(mockForumChannel);
      mockRuntimeConfigRepository.setConfig.mockResolvedValue(
        {} as RuntimeConfig
      );

      const result = await threadService.getOpenTagId();

      expect(result).toBe(newTagId);
      expect(mockForumChannel.setAvailableTags).toHaveBeenCalled();
      expect(mockRuntimeConfigRepository.setConfig).toHaveBeenCalledWith(
        config.guildId,
        { openTagId: newTagId }
      );
    });

    it("should find and return existing Open tag ID from forum channel", async () => {
      const forumChannelId = randomSnowflakeID();
      const existingTagId = randomSnowflakeID();
      const runtimeConfig = {
        openTagId: null,
        forumChannelId,
      } as RuntimeConfig;

      mockRuntimeConfigRepository.getConfig.mockResolvedValue(runtimeConfig);

      // Mock forum channel fetch with existing Open tag
      const mockForumChannel = {
        type: ChannelType.GuildForum,
        availableTags: [{ name: "Open", id: existingTagId }],
      } as unknown as ForumChannel;

      spyOn(client.channels, "fetch").mockResolvedValue(mockForumChannel);
      mockRuntimeConfigRepository.setConfig.mockResolvedValue(
        {} as RuntimeConfig
      );

      const result = await threadService.getOpenTagId();

      expect(result).toBe(existingTagId);
      expect(client.channels.fetch).toHaveBeenCalledWith(forumChannelId);
      expect(mockRuntimeConfigRepository.setConfig).toHaveBeenCalledWith(
        config.guildId,
        { openTagId: existingTagId }
      );
    });

    it("should handle invalid forum channel", async () => {
      const forumChannelId = randomSnowflakeID();
      const runtimeConfig = {
        openTagId: null,
        forumChannelId,
      } as RuntimeConfig;

      mockRuntimeConfigRepository.getConfig.mockResolvedValue(runtimeConfig);

      // Mock invalid channel type
      const invalidChannel = {
        type: ChannelType.GuildText,
      } as unknown as TextChannel;

      spyOn(client.channels, "fetch").mockResolvedValue(invalidChannel);

      await expect(threadService.getOpenTagId()).rejects.toThrow(
        `Invalid forum channel: ${forumChannelId} (${ChannelType.GuildText})`
      );
    });
  });

  describe("getClosedTagId", () => {
    it("should return the closed tag ID from runtime config", async () => {
      const runtimeConfig = {
        closedTagId: "closedTagId123",
        forumChannelId: randomSnowflakeID(),
      } as RuntimeConfig;

      const mockForumChannel = {
        type: ChannelType.GuildForum,
        availableTags: [{ name: "Closed", id: "closedTagId123" }],
      } as unknown as ForumChannel;

      mockRuntimeConfigRepository.getConfig.mockResolvedValue(runtimeConfig);
      spyOn(client.channels, "fetch").mockResolvedValue(mockForumChannel);

      const result = await threadService.getClosedTagId();

      expect(result).toBe("closedTagId123");
      expect(mockRuntimeConfigRepository.getConfig).toHaveBeenCalledWith(
        config.guildId
      );
    });

    it("should find and return existing Closed tag ID from forum channel", async () => {
      const forumChannelId = randomSnowflakeID();
      const existingTagId = randomSnowflakeID();
      const runtimeConfig = {
        closedTagId: null,
        forumChannelId,
      } as RuntimeConfig;

      mockRuntimeConfigRepository.getConfig.mockResolvedValue(runtimeConfig);

      // Mock forum channel fetch with existing Closed tag
      const mockForumChannel = {
        type: ChannelType.GuildForum,
        availableTags: [{ name: "Closed", id: existingTagId }],
      } as unknown as ForumChannel;

      spyOn(client.channels, "fetch").mockResolvedValue(mockForumChannel);
      mockRuntimeConfigRepository.setConfig.mockResolvedValue(
        {} as RuntimeConfig
      );

      const result = await threadService.getClosedTagId();

      expect(result).toBe(existingTagId);
      expect(client.channels.fetch).toHaveBeenCalledWith(forumChannelId);
      expect(mockRuntimeConfigRepository.setConfig).toHaveBeenCalledWith(
        config.guildId,
        { closedTagId: existingTagId }
      );
    });

    it("should create a new Closed tag if none exists", async () => {
      const forumChannelId = randomSnowflakeID();
      const newTagId = randomSnowflakeID();
      const runtimeConfig = {
        closedTagId: null,
        forumChannelId,
      } as RuntimeConfig;

      mockRuntimeConfigRepository.getConfig.mockResolvedValue(runtimeConfig);

      // Mock forum channel with no existing Closed tag
      const mockForumChannel = {
        type: ChannelType.GuildForum,
        availableTags: [],
        setAvailableTags: mock().mockResolvedValue({
          availableTags: [{ name: "Closed", id: newTagId }],
        }),
      } as unknown as ForumChannel;

      spyOn(client.channels, "fetch").mockResolvedValue(mockForumChannel);
      mockRuntimeConfigRepository.setConfig.mockResolvedValue(
        {} as RuntimeConfig
      );

      const result = await threadService.getClosedTagId();

      expect(result).toBe(newTagId);
      expect(mockForumChannel.setAvailableTags).toHaveBeenCalled();
      expect(mockRuntimeConfigRepository.setConfig).toHaveBeenCalledWith(
        config.guildId,
        { closedTagId: newTagId }
      );
    });
  });

  describe("getOrCreateThread", () => {
    it("should return an existing thread if found", async () => {
      const username = "testuser";
      const existingThread = mockThread();
      const userId = existingThread.userId;

      mockThreadRepository.getOpenThreadByUserID.mockResolvedValue(
        existingThread
      );

      const { thread, isNew } = await threadService.getOrCreateThread(
        userId,
        username
      );

      expect(isNew).toBe(false);
      expect(thread).toBe(existingThread);
      expect(mockThreadRepository.getOpenThreadByUserID).toHaveBeenCalledWith(
        userId
      );
    });

    it("should create a new thread if none exists", async () => {
      const username = "testuser";
      const newThread = mockThread();
      const userId = newThread.userId;

      mockThreadRepository.getOpenThreadByUserID.mockResolvedValue(null);
      spyOn(threadService as any, "createNewThread").mockResolvedValue(
        newThread
      );

      const { thread, isNew } = await threadService.getOrCreateThread(
        userId,
        username
      );

      expect(isNew).toBe(true);
      expect(thread).toBe(newThread);
      expect(mockThreadRepository.getOpenThreadByUserID).toHaveBeenCalledWith(
        userId
      );
      expect(threadService["createNewThread"]).toHaveBeenCalledWith(
        userId,
        username,
        undefined
      );
    });
  });

  describe("createNewThread", () => {
    it("should throw an error if modmail forum channel is not found", async () => {
      const userId = randomSnowflakeID();
      const username = "testuser";
      const forumChannelId = randomSnowflakeID();

      spyOn(client.guilds.cache, "get").mockReturnValue(guildMock);
      mockRuntimeConfigRepository.getConfig.mockResolvedValue({
        forumChannelId,
      } as RuntimeConfig);
      spyOn(client.channels, "fetch").mockResolvedValue(null);

      await expect(
        threadService["createNewThread"](userId, username)
      ).rejects.toThrow(`Modmail forum channel not found: ${forumChannelId}`);
    });

    it("should throw an error if guild is not found", async () => {
      const userId = randomSnowflakeID();
      const username = "testuser";

      spyOn(client.guilds.cache, "get").mockReturnValue(undefined);

      await expect(
        threadService["createNewThread"](userId, username)
      ).rejects.toThrow(`Guild not found: ${config.guildId}`);
    });

    it("should throw an error if modmail forum channel is not a GuildForum", async () => {
      const userId = randomSnowflakeID();
      const username = "testuser";
      const forumChannelId = randomSnowflakeID();
      const invalidChannel = { type: ChannelType.GuildText } as TextChannel;

      spyOn(client.guilds.cache, "get").mockReturnValue(guildMock);
      mockRuntimeConfigRepository.getConfig.mockResolvedValue({
        forumChannelId,
      } as RuntimeConfig);
      spyOn(client.channels, "fetch").mockResolvedValue(invalidChannel);

      await expect(
        threadService["createNewThread"](userId, username)
      ).rejects.toThrow(`Invalid modmail forum channel: ${forumChannelId}`);
    });

    it("should create a new thread and return it", async () => {
      const userId = randomSnowflakeID();
      const username = "testuser";
      const openTagId = randomSnowflakeID();
      const forumChannelId = randomSnowflakeID();

      const modmailForumChannel = {
        type: ChannelType.GuildForum,
        threads: {
          create: mock().mockResolvedValue({
            id: "threadId",
            guildId: "guildId",
          }),
        },
      } as unknown as ForumChannel;

      const mockUser = {
        id: "123",
      } as unknown as User;

      spyOn(client.guilds.cache, "get").mockReturnValue(guildMock);
      mockRuntimeConfigRepository.getConfig.mockResolvedValue({
        forumChannelId,
      } as RuntimeConfig);
      spyOn(client.users, "fetch").mockResolvedValue(mockUser);
      spyOn(client.channels, "fetch").mockResolvedValue(modmailForumChannel);
      spyOn(threadService, "getOpenTagId").mockResolvedValue(openTagId);

      spyOn(mutualServersUtil, "getMutualServers").mockResolvedValue([]);

      spyOn(StaffThreadView, "createThreadOptions").mockReturnValue({
        name: "threadName",
        reason: "reason",
      });
      spyOn(StaffThreadView, "initialThreadMessage").mockReturnValue({
        content: "initialMessage",
      });

      const thread = mockThread();
      mockThreadRepository.createThread.mockResolvedValue(thread);
      mockThreadRepository.getAllThreadsByUserId.mockResolvedValue([]);

      const result = await threadService["createNewThread"](userId, username);

      expect(result).toBeInstanceOf(Thread);
      expect(mutualServersUtil.getMutualServers).toHaveBeenCalledWith(
        client,
        userId
      );
      expect(modmailForumChannel.threads.create).toHaveBeenCalledWith({
        name: "threadName",
        reason: "reason",
        message: {
          content: "initialMessage",
        },
        appliedTags: [openTagId],
      });
      expect(mockThreadRepository.createThread).toHaveBeenCalledWith(
        "guildId",
        userId,
        "threadId"
      );
    });

    it("should create a new thread with new open tag when none exists", async () => {
      const userId = randomSnowflakeID();
      const username = "testuser";
      const newOpenTagId = randomSnowflakeID();
      const forumChannelId = randomSnowflakeID();

      const modmailForumChannel = {
        type: ChannelType.GuildForum,
        threads: {
          create: mock().mockResolvedValue({
            id: "threadId",
            guildId: "guildId",
          }),
        },
      } as unknown as ForumChannel;

      const mockUser = {
        id: "123",
      } as unknown as User;

      spyOn(client.guilds.cache, "get").mockReturnValue(guildMock);
      mockRuntimeConfigRepository.getConfig.mockResolvedValue({
        forumChannelId,
      } as RuntimeConfig);
      spyOn(client.users, "fetch").mockResolvedValue(mockUser);
      spyOn(client.channels, "fetch").mockResolvedValue(modmailForumChannel);
      spyOn(threadService, "getOpenTagId").mockResolvedValue(newOpenTagId);
      spyOn(mutualServersUtil, "getMutualServers").mockResolvedValue([]);

      spyOn(StaffThreadView, "createThreadOptions").mockReturnValue({
        name: "threadName",
        reason: "reason",
      });
      spyOn(StaffThreadView, "initialThreadMessage").mockReturnValue({
        content: "initialMessage",
      });

      const thread = mockThread();
      mockThreadRepository.createThread.mockResolvedValue(thread);
      mockThreadRepository.getAllThreadsByUserId.mockResolvedValue([]);

      const result = await threadService["createNewThread"](userId, username);

      expect(result).toBeInstanceOf(Thread);
      expect(threadService.getOpenTagId).toHaveBeenCalled();
      expect(modmailForumChannel.threads.create).toHaveBeenCalledWith({
        name: "threadName",
        reason: "reason",
        message: {
          content: "initialMessage",
        },
        appliedTags: [newOpenTagId],
      });
    });
  });

  describe("closeThread", () => {
    it("should throw an error if thread channel is not found", async () => {
      const thread = { channelId: "channelId" } as Thread;
      spyOn(client.channels, "fetch").mockResolvedValue(null);

      await expect(threadService.closeThread(thread, "userId")).rejects.toThrow(
        `Thread channel not found: ${thread.channelId}`
      );
    });

    it("should throw an error if channel is not a thread", async () => {
      const thread = { channelId: "channelId" } as Thread;
      const invalidChannel = { isThread: () => false } as ForumChannel;
      spyOn(client.channels, "fetch").mockResolvedValue(invalidChannel);

      await expect(threadService.closeThread(thread, "userId")).rejects.toThrow(
        `Not thread: ${thread.channelId}`
      );
    });

    it("should close the thread and mark it as closed in the repository", async () => {
      const thread = {
        channelId: "channelId",
        guildId: "guildId",
        originalMessageLink:
          "https://discord.com/channels/guildId/channelId/messageId",
      } as Thread;
      const openTagId = "openTagId123";
      const closedTagId = "closedTagId456";

      const runtimeConfig = {
        openTagId: openTagId,
        forumChannelId: randomSnowflakeID(),
      } as RuntimeConfig;

      const threadChannel = {
        isThread: () => true,
        appliedTags: ["unrelatedTag", openTagId],
        send: mock(),
        edit: mock(),
      } as unknown as ForumThreadChannel;

      mockRuntimeConfigRepository.getConfig.mockResolvedValue(runtimeConfig);
      spyOn(client.channels, "fetch").mockResolvedValue(threadChannel);
      spyOn(threadService, "getClosedTagId").mockResolvedValue(closedTagId);

      await threadService.closeThread(thread, "userId");

      expect(threadChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          components: expect.any(Array),
          flags: expect.any(Number),
          allowedMentions: expect.any(Object),
        })
      );
      expect(threadService.getClosedTagId).toHaveBeenCalled();
      expect(threadChannel.edit).toHaveBeenCalledWith({
        archived: true,
        locked: true,
        // Should remove open tag and add closed tag, keeping unrelated tags
        appliedTags: ["unrelatedTag", closedTagId],
      });
      expect(mockThreadRepository.closeThread).toHaveBeenCalledWith(
        thread.channelId,
        "userId"
      );
    });
  });

  describe("getThreadByChannelId", () => {
    it("should return the thread by channel ID", async () => {
      const thread = mockThread();
      const channelId = thread.channelId;

      mockThreadRepository.getThreadByChannelId.mockResolvedValue(thread);

      const result = await threadService.getThreadByChannelId(channelId);

      expect(result).toBe(thread);
      expect(mockThreadRepository.getThreadByChannelId).toHaveBeenCalledWith(
        channelId
      );
    });
  });

  describe("getAllThreadsByUserId", () => {
    it("should return all threads by user ID", async () => {
      const userId = randomSnowflakeID();
      const threadOpts = {
        userId: userId,
      };

      const threadClosedOpts = {
        userId: userId,
      };

      const threads = [
        mockThread(threadOpts),
        mockThread(threadClosedOpts),
        mockThread(threadClosedOpts),
      ];

      mockThreadRepository.getAllThreadsByUserId.mockResolvedValue(threads);

      const result = await threadService.getAllThreadsByUserId(userId);

      expect(result).toBe(threads);
      expect(mockThreadRepository.getAllThreadsByUserId).toHaveBeenCalledWith(
        userId
      );
    });
  });

  describe("getMutualServers", () => {
    it("should return mutual servers", async () => {
      const userId = randomSnowflakeID();
      const guildId1 = randomSnowflakeID();
      const guildId2 = randomSnowflakeID();

      const guild1 = {
        id: guildId1,
        name: "Server 1",
        members: { fetch: mock() },
      };

      const guild2 = {
        id: guildId2,
        name: "Server 2",
        members: { fetch: mock() },
      };

      const guildsMock: Collection<Snowflake, Guild> = new Collection([
        [guildId1, guild1 as unknown as Guild],
        [guildId2, guild2 as unknown as Guild],
      ]);

      // Setup the successful fetch for guild1
      guild1.members.fetch.mockResolvedValue(123);

      // Setup the error for guild2
      const unknownMemberError = new DiscordAPIError(
        { code: RESTJSONErrorCodes.UnknownMember, message: "Unknown Member" },
        RESTJSONErrorCodes.UnknownMember,
        404,
        "GET",
        "",
        {}
      );

      guild2.members.fetch.mockRejectedValue(unknownMemberError);

      // Mock the guilds cache values to return our guilds
      spyOn(client.guilds.cache, "values").mockReturnValue(guildsMock.values());

      // Clear mocks on mutualServersUtil
      spyOn(mutualServersUtil, "getMutualServers").mockRestore();

      const result = await mutualServersUtil.getMutualServers(client, userId);

      expect(result).toEqual([{ id: guildId1, name: "Server 1" }]);
      expect(guild1.members.fetch).toHaveBeenCalledWith(userId);
      expect(guild2.members.fetch).toHaveBeenCalledWith(userId);
    });
  });
});
