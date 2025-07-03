import type { Client, Guild, SendableChannels } from "discord.js";
import type { RelayUser } from "models/relayMessage";
import type { ThreadRepository } from "repositories/thread.repository";
import { getLogger } from "utils/logger";
import { getMutualServers } from "utils/mutualServers";
import { MemberNotificationView } from "views/MemberNotificationView";
import type { NotificationType } from "views/MemberNotificationView";

interface Config {
  guildId: string;
}

export class MemberNotificationService {
  private config: Config;
  private client: Client;
  private threadRepository: ThreadRepository;
  private logger = getLogger(this.constructor.name);

  constructor(
    config: Config,
    client: Client,
    threadRepository: ThreadRepository
  ) {
    this.config = config;
    this.client = client;
    this.threadRepository = threadRepository;
  }

  async notify(
    action: NotificationType,
    guild: Guild,
    user: RelayUser,
    options?: { until?: Date }
  ): Promise<void> {
    const thread = await this.threadRepository.getOpenThreadByUserID(user.id);
    if (!thread) {
      // No thread found for user, no notification
      return;
    }

    this.logger.info(
      {
        userId: user.id,
        action,
      },
      `Retrieving thread channel for thread notification`
    );

    const channel = await this.client.channels.fetch(thread.channelId);
    if (!channel || !channel.isSendable()) {
      throw new Error(`Channel not found or not sendable for user ${user.id}`);
    }

    this.logger.info(
      { userId: user.id, action },
      `Sending member notification to thread`
    );

    const inPrimaryGuild = guild.id === this.config.guildId;

    const mutualServers = await getMutualServers(this.client, user.id);

    const msg = MemberNotificationView.buildNotificationMessage(
      action,
      user,
      inPrimaryGuild,
      guild.name,
      mutualServers,
      options
    );
    await channel.send(msg);
  }
}
