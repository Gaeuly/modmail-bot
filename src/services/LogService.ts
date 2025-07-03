import { ChannelType, Client, Colors, EmbedBuilder } from "discord.js";
import { getLogger } from "../utils/logger";
import type { Logger } from "pino";
import type { RuntimeConfig } from "models/runtimeConfig.model";
import type { UpdateConfig } from "repositories/runtimeConfig.repository";

export interface LogService {
  logError(error: Error | any, context: string, source: string): Promise<void>;
}

interface ConfigRepository {
  getConfig(guildId: string): Promise<RuntimeConfig>;
  setConfig(guildId: string, changes: UpdateConfig): Promise<RuntimeConfig>;
}

export class DiscordLogService implements LogService {
  private client: Client;
  private configRepository: ConfigRepository;
  private guildId: string;

  private logger: Logger;

  constructor(
    client: Client,
    configRepository: ConfigRepository,
    guildId: string
  ) {
    this.client = client;
    this.configRepository = configRepository;
    this.guildId = guildId;

    this.logger = getLogger("LogService");
  }

  /**
   * Logs an error to both the console and the logs channel if configured
   * @param error The error to log
   * @param context Additional context about the error
   * @param source The source of the error (e.g. class name)
   */
  async logError(
    error: Error | any,
    context: string,
    source: string
  ): Promise<void> {
    // Always log to console first
    this.logger.error(error, `[${source}] ${context}`);

    let config = await this.configRepository.getConfig(this.guildId);
    if (!config.forumChannelId) {
      // No config yet
      return;
    }

    if (!config.logsChannelId) {
      // Create a thread within the modmail channel
      this.logger.info(
        "No logs channel configured, creating a thread in the modmail channel"
      );

      const modmailChannel = await this.client.channels.fetch(
        config.forumChannelId
      );

      if (!modmailChannel) {
        this.logger.warn(`Modmail channel not found: ${config.forumChannelId}`);

        return;
      }

      if (modmailChannel.type !== ChannelType.GuildForum) {
        this.logger.warn(
          `Modmail channel is not a forum channel: ${config.forumChannelId}`
        );

        return;
      }

      // Create a thread in the forum channel
      const logsThread = await modmailChannel.threads.create({
        name: `Error Logs`,
        message: {
          content: `This thread is for error logs. Any failures when someone DMs the bot will be logged here.`,
        },
      });

      config = await this.configRepository.setConfig(this.guildId, {
        logsChannelId: logsThread.id,
      });

      if (!config.logsChannelId) {
        throw new Error(
          `Logs channel ID in config missing after update: ${this.guildId}`
        );
      }
    }

    try {
      const channel = await this.client.channels.fetch(config.logsChannelId);

      if (!channel || !channel.isTextBased() || channel.isDMBased()) {
        this.logger.warn(
          {
            guildId: this.guildId,
            logsChannelId: config.logsChannelId,
          },
          `Logs channel not found or not sendable, could have been deleted if null... resetting configured channel`
        );

        await this.configRepository.setConfig(this.guildId, {
          // Clear the logs channel ID since it's no longer valid
          logsChannelId: null,
        });

        return;
      }

      const errMessage =
        error.message || String(error).substring(0, 1024) || "Unknown error";
      const stackTrace = error.stack
        ? error.stack.substring(0, 1024)
        : "No stack trace available";

      const errorEmbed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle(`Error in ${source}`)
        .setDescription(context)
        .addFields(
          {
            name: "Error Message",
            value: `\`\`\`\n${errMessage}\`\`\``,
          },
          {
            name: "Stack Trace",
            value: `\`\`\`\n${stackTrace}\`\`\``,
          }
        )
        .setTimestamp();

      await channel.send({ embeds: [errorEmbed] });
    } catch (err) {
      // Just log to console if sending to Discord fails - avoid infinite loops
      this.logger.error(err, `Failed to send error log to Discord channel`);
    }
  }
}
