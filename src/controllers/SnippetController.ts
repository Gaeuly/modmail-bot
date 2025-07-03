import { Client, Message, MessageFlags } from "discord.js";
import { getLogger } from "../utils/logger";
import type { Logger } from "pino";
import type { StaffMessageOptions } from "../services/MessageRelayService";
import type {
  UserThreadViewGuild,
  UserThreadViewUser,
} from "views/UserThreadView";
import { StaffThreadView } from "views/StaffThreadView";
import type { StaffToUserMessage } from "../models/relayMessage";
import type { RuntimeConfig } from "models/runtimeConfig.model";

export interface Thread {
  userId: string;
  channelId: string;
  guildId: string;
}

export interface Snippet {
  guildId: string;
  name: string;
  content: string;
}

export interface SnippetService {
  getSnippet(guildId: string, name: string): Promise<Snippet | null>;
}

export interface ThreadService {
  getThreadByChannelId(channelId: string): Promise<Thread | null>;
}

export interface MessageRelayService {
  relayStaffMessageToUser(
    threadId: string,
    userId: string,
    guild: UserThreadViewGuild,
    msg: StaffToUserMessage,
    options?: StaffMessageOptions
  ): Promise<void>;
}

interface ConfigRepository {
  getConfig(guildId: string): Promise<RuntimeConfig>;
}

export class SnippetController {
  private snippetService: SnippetService;
  private threadService: ThreadService;
  private messageService: MessageRelayService;

  private configRepository: ConfigRepository;

  private logger: Logger = getLogger(this.constructor.name);

  constructor(
    snippetService: SnippetService,
    threadService: ThreadService,
    messageService: MessageRelayService,
    configRepository: ConfigRepository
  ) {
    this.snippetService = snippetService;
    this.threadService = threadService;
    this.messageService = messageService;
    this.configRepository = configRepository;
  }

  async handleThreadMessage(client: Client, message: Message): Promise<void> {
    try {
      if (!message.inGuild()) {
        return;
      }

      if (!message.channel.isThread()) {
        return;
      }

      const config = await this.configRepository.getConfig(message.guildId);

      if (!config.forumChannelId) {
        return;
      }

      // Check if this is the modmail channel
      if (message.channel.parentId !== config.forumChannelId) {
        return;
      }

      // Skip if not starting with the snippet prefix '-'
      if (!message.content.startsWith(config.prefix) || message.author.bot) {
        return;
      }

      // Find modmail thread
      const thread = await this.threadService.getThreadByChannelId(
        message.channel.id
      );

      if (!thread) {
        return;
      }

      // Extract snippet name (removing the configured prefix)
      const snippetName = message.content
        .slice(config.prefix.length)
        .trim()
        .split(/\s+/)[0];

      if (!snippetName) {
        return;
      }

      this.logger.debug(
        `Looking for snippet: ${snippetName} in guild ${thread.guildId}`
      );

      // Get the snippet
      const snippet = await this.snippetService.getSnippet(
        thread.guildId,
        snippetName
      );

      if (!snippet) {
        // Ignore
        this.logger.debug(`Snippet not found: ${snippetName}`);
        return;
      }

      // Get the guild
      const guild = client.guilds.cache.get(thread.guildId);
      if (!guild) {
        throw new Error(`Guild not found: ${thread.guildId}`);
      }

      // Relay the snippet content to the user
      const options: StaffMessageOptions = {
        anonymous: config.anonymousSnippets,
        plainText: message.content.includes("-p"),
        snippet: true,
        snippetName: snippetName,
      };

      this.logger.debug(
        {
          snippet: snippetName,
          userId: thread.userId,
          options,
        },
        `Sending snippet to user`
      );

      // Override the message content with the snippet content before relaying
      message.content = snippet.content;

      await this.messageService.relayStaffMessageToUser(
        message.channelId,
        thread.userId,
        guild,
        {
          ...message,
          attachments: Array.from(message.attachments.values()),
          stickers: Array.from(message.stickers.values()),
          createdTimestamp: message.createdTimestamp,
        },
        options
      );

      // Delete the original message
      await message.delete();
    } catch (err) {
      this.logger.error(err, `Error handling snippet command`);
      await message.reply(
        "An error occurred while processing the snippet command."
      );
    }
  }
}
