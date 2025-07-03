import {
  ChannelType,
  Client,
  DiscordAPIError,
  ForumChannel,
  GuildMember,
  RESTJSONErrorCodes,
  type GuildForumTagData,
  type GuildForumTagEmoji,
} from "discord.js";
import { Thread } from "../models/thread.model";
import { StaffThreadEmojis, StaffThreadView } from "../views/StaffThreadView";
import { getLogger } from "utils/logger";
import type { RuntimeConfig } from "models/runtimeConfig.model";
import type { runtimeConfig } from "database/schema";
import type { UpdateConfig } from "repositories/runtimeConfig.repository";
import type { BotEmojiRepository } from "repositories/botEmoji.repository";
import { getMutualServers } from "utils/mutualServers";

// Global constant for the open tag name
const OPEN_TAG_NAME = "Open";
const CLOSED_TAG_NAME = "Closed";

// Tag emoji mappings
const TAG_EMOJIS: Record<string, GuildForumTagEmoji> = {
  open: { id: null, name: "📨" },
  closed: { id: null, name: "🔒" },
} as const;

// Tag configuration mapping
const TAG_CONFIG_MAP: Record<string, GuildForumTagData> = {
  openTagId: { name: OPEN_TAG_NAME, emoji: TAG_EMOJIS.open },
  closedTagId: { name: CLOSED_TAG_NAME, emoji: TAG_EMOJIS.closed },
} as const;

interface Config {
  guildId: string;
}

interface ThreadRepository {
  getOpenThreadByUserID(userId: string): Promise<Thread | null>;
  getThreadByChannelId(channelId: string): Promise<Thread | null>;
  getAllThreadsByUserId(userId: string): Promise<Thread[]>;
  createThread(
    guildId: string,
    userId: string,
    channelId: string
  ): Promise<Thread>;
  closeThread(channelId: string, userId: string): Promise<void>;
}

interface RuntimeConfigRepository {
  getConfig(guildId: string): Promise<RuntimeConfig>;
  setConfig(guildId: string, changes: UpdateConfig): Promise<RuntimeConfig>;
}

export class ThreadService {
  private config: Config;

  private client: Client;

  private runtimeConfigRepository: RuntimeConfigRepository;
  private threadRepository: ThreadRepository;
  private emojiRepository: BotEmojiRepository;

  private logger = getLogger("ThreadService");

  constructor(
    config: Config,
    client: Client,
    runtimeConfigRepository: RuntimeConfigRepository,
    threadRepository: ThreadRepository,
    emojiRepository: BotEmojiRepository
  ) {
    this.config = config;
    this.client = client;

    this.runtimeConfigRepository = runtimeConfigRepository;
    this.threadRepository = threadRepository;
    this.emojiRepository = emojiRepository;
  }

  private async getForumChannel(forumChannelId: string): Promise<ForumChannel> {
    // Ensure channel exists and is a forum channel
    const forumChannel = await this.client.channels.fetch(forumChannelId);

    if (!forumChannel || forumChannel.type !== ChannelType.GuildForum) {
      throw new Error(
        `Invalid forum channel: ${forumChannelId} (${forumChannel?.type})`
      );
    }

    return forumChannel;
  }

  private async getForumTagId(
    configKey: "openTagId" | "closedTagId"
  ): Promise<string> {
    const runtimeConfig = await this.runtimeConfigRepository.getConfig(
      this.config.guildId
    );

    if (!runtimeConfig.forumChannelId) {
      throw new Error(
        `Not initialized yet: Forum channel ID not set in runtime config: ${this.config.guildId}`
      );
    }

    const forumChannel = await this.getForumChannel(
      runtimeConfig.forumChannelId
    );

    // Check if there's an ID stored in the runtime config
    const existingTagId = runtimeConfig[configKey];
    if (existingTagId) {
      // Validate that the tag still exists in the forum channel
      const tagExists = forumChannel.availableTags.some(
        (tag) => tag.id === existingTagId
      );

      // Found tag!
      if (tagExists) {
        return existingTagId;
      }

      this.logger.warn(
        `Tag ID ${existingTagId} for ${configKey} no longer exists in forum channel, will recreate`
      );
    }

    const tagConfig = TAG_CONFIG_MAP[configKey];

    // Check for any existing tag by name
    const existingTag = forumChannel.availableTags.find(
      (tag) => tag.name === tagConfig.name
    );

    if (existingTag) {
      this.logger.info(
        `Found existing "${tagConfig.name}" tag with ID ${existingTag.id}, saving to runtime config`
      );

      // Save the found tag ID to avoid future lookups
      await this.runtimeConfigRepository.setConfig(this.config.guildId, {
        [configKey]: existingTag.id,
      });

      return existingTag.id;
    }

    this.logger.info(
      `No existing "${tagConfig.name}" tag found, creating new one`
    );

    // Create the tag if it doesn't exist
    return this.createForumTag(forumChannel, configKey, tagConfig);
  }

  private async createForumTag(
    forumChannel: ForumChannel,
    configKey: "openTagId" | "closedTagId",
    tagConfig: GuildForumTagData
  ): Promise<string> {
    this.logger.info(`Creating new "${tagConfig.name}" forum tag`);

    try {
      const currentTags: GuildForumTagData[] = [
        ...forumChannel.availableTags,
        {
          name: tagConfig.name,
          emoji: tagConfig.emoji,
          moderated: tagConfig.moderated,
        },
      ];

      const updatedChannel = await forumChannel.setAvailableTags(currentTags);

      // Find the newly created tag
      const createdTag = updatedChannel.availableTags.find(
        (tag) => tag.name === tagConfig.name
      );

      if (!createdTag) {
        throw new Error(`${tagConfig.name} tag not found after creation`);
      }

      this.logger.info(
        { [configKey]: createdTag.id },
        `Successfully created forum tag '${tagConfig.name}'`
      );

      // Save the new tag ID to runtime config
      await this.runtimeConfigRepository.setConfig(this.config.guildId, {
        [configKey]: createdTag.id,
      });

      return createdTag.id;
    } catch (error) {
      this.logger.error(
        { error, tagName: tagConfig.name, configKey },
        `Failed to create forum tag`
      );

      throw new Error(
        `Failed to create forum tag "${tagConfig.name}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async getOpenTagId(): Promise<string> {
    return this.getForumTagId("openTagId");
  }

  async getClosedTagId(): Promise<string> {
    return this.getForumTagId("closedTagId");
  }

  async getThread(userId: string): Promise<Thread | null> {
    return this.threadRepository.getOpenThreadByUserID(userId);
  }

  async getOrCreateThread(
    userId: string,
    username: string,
    forceSilent?: boolean
  ): Promise<{ thread: Thread; isNew: boolean }> {
    let thread = await this.threadRepository.getOpenThreadByUserID(userId);
    const isNew = !thread;

    if (!thread) {
      this.logger.debug(`Creating new thread for user ${userId}`);
      thread = await this.createNewThread(userId, username, forceSilent);
    }

    return { thread, isNew };
  }

  private async createNewThread(
    userId: string,
    username: string,
    forceSilent?: boolean
  ): Promise<Thread> {
    const guild = this.client.guilds.cache.get(this.config.guildId);
    if (!guild) {
      throw new Error(`Guild not found: ${this.config.guildId}`);
    }

    const runtimeConfig = await this.runtimeConfigRepository.getConfig(
      this.config.guildId
    );

    if (!runtimeConfig.forumChannelId) {
      throw new Error(
        `Not initialized yet: Forum channel ID not set in runtime config: ${this.config.guildId}`
      );
    }

    const modmailForumChannel = await this.client.channels.fetch(
      runtimeConfig.forumChannelId
    );

    if (!modmailForumChannel) {
      throw new Error(
        `Modmail forum channel not found: ${runtimeConfig.forumChannelId}`
      );
    }

    if (modmailForumChannel.type !== ChannelType.GuildForum) {
      throw new Error(
        `Invalid modmail forum channel: ${runtimeConfig.forumChannelId}`
      );
    }

    // -------------------------------------------------------------------------
    // Get recipient

    let member: GuildMember | null = null;
    try {
      member = await guild.members.fetch(userId);
    } catch (err) {
      // Fine if the member is not found
    }
    const user = await this.client.users.fetch(userId);

    // -------------------------------------------------------------------------
    // Get / create open tag
    let openTagID = await this.getOpenTagId();

    // -------------------------------------------------------------------------
    // Get user metadata, previous threads and mutual servers
    const previousThreads = await this.threadRepository.getAllThreadsByUserId(
      userId
    );

    const mutualServers = await getMutualServers(this.client, userId);

    // -------------------------------------------------------------------------
    // Create Forum thread

    const threadMetadata = StaffThreadView.createThreadOptions(
      userId,
      username
    );

    const emojis = await this.emojiRepository.getEmojiMap(StaffThreadEmojis);
    const threadInitialMsg = StaffThreadView.initialThreadMessage(
      emojis,
      {
        user: user,
        member: member,
        previousThreads: previousThreads,
        mutualGuilds: mutualServers,
      },
      runtimeConfig.notificationRoleId,
      runtimeConfig.notificationSilent,
      forceSilent
    );

    const discordThread = await modmailForumChannel.threads.create({
      name: threadMetadata.name,
      reason: threadMetadata.reason,
      message: threadInitialMsg,
      appliedTags: [openTagID],
    });

    // -------------------------------------------------------------------------
    // Save to database
    const thread = this.threadRepository.createThread(
      discordThread.guildId,
      userId,
      discordThread.id
    );

    this.logger.debug(thread, `Created new thread`);

    return thread;
  }

  async closeThread(
    thread: Thread,
    userId: string,
    closeReason?: string
  ): Promise<void> {
    const threadChannel = await this.client.channels.fetch(thread.channelId);
    if (!threadChannel) {
      throw new Error(`Thread channel not found: ${thread.channelId}`);
    }

    if (!threadChannel.isThread()) {
      throw new Error(`Not thread: ${thread.channelId}`);
    }

    this.logger.debug(`Locking and closing thread: ${thread.channelId}`);

    // Send closed message with embed and jump link
    const closedMessage = StaffThreadView.threadClosedMessage(
      thread.originalMessageLink,
      closeReason
    );
    await threadChannel.send(closedMessage);

    const config = await this.runtimeConfigRepository.getConfig(
      this.config.guildId
    );

    // Remove open tag, but keep the rest if there's any custom
    const remainingTags = threadChannel.appliedTags.filter(
      (tagId) => tagId !== config.openTagId
    );

    // Get / create closed tag
    let closedTagId = await this.getClosedTagId();

    // Push closed tag if not already present
    if (!remainingTags.includes(closedTagId)) {
      remainingTags.push(closedTagId);
    }

    this.logger.debug(
      {
        threadId: thread.channelId,
        userId: userId,
        remainingTags: remainingTags,
      },
      `Closing thread`
    );

    // Lock and close the forum thread as completed
    await threadChannel.edit({
      archived: true,
      locked: true,
      appliedTags: remainingTags,
    });

    // Mark as closed in db
    await this.threadRepository.closeThread(thread.channelId, userId);
  }

  /**
   * Get a thread by its Discord channel ID
   * @param channelId The Discord channel ID of the thread
   * @returns The thread information or null if not found
   */
  async getThreadByChannelId(channelId: string): Promise<Thread | null> {
    return this.threadRepository.getThreadByChannelId(channelId);
  }

  /**
   * Get all threads created by a specific user
   * @param userId The Discord user ID
   * @returns Array of threads created by the user
   */
  async getAllThreadsByUserId(userId: string): Promise<Thread[]> {
    return this.threadRepository.getAllThreadsByUserId(userId);
  }
}
