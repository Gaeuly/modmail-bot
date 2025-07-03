import {
  MessageReaction,
  User,
  type PartialMessageReaction,
  type PartialUser,
} from "discord.js";
import { getLogger } from "../utils/logger";
import type { RuntimeConfig } from "models/runtimeConfig.model";

export interface StaffReactionRelayService {
  relayStaffReactionToUser(
    threadMessageId: string,
    emoji: string
  ): Promise<void>;
  relayStaffReactionRemovalToUser(
    threadMessageId: string,
    emoji: string
  ): Promise<void>;
}

interface ConfigRepository {
  getConfig(guildId: string): Promise<RuntimeConfig>;
}

export class StaffReactionController {
  private reactionService: StaffReactionRelayService;
  private configRepository: ConfigRepository;

  private logger = getLogger(this.constructor.name);

  constructor(
    reactionService: StaffReactionRelayService,
    configRepository: ConfigRepository
  ) {
    this.reactionService = reactionService;
    this.configRepository = configRepository;
  }

  async handleStaffReactionAdd(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
  ): Promise<void> {
    try {
      if (!reaction.message.inGuild()) {
        return;
      }

      if (!reaction.message.channel.isThread()) {
        return;
      }

      const config = await this.configRepository.getConfig(
        reaction.message.guildId
      );

      if (!config.forumChannelId) {
        return;
      }

      // Ignore unrelated threads
      if (reaction.message.channel.parentId !== config.forumChannelId) {
        return;
      }

      await this.reactionService.relayStaffReactionToUser(
        reaction.message.id,
        reaction.emoji.identifier
      );
    } catch (err) {
      this.logger.error(err, `Error handling staff reaction`);
    }
  }

  async handleStaffReactionRemove(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
  ): Promise<void> {
    try {
      if (!reaction.message.inGuild()) {
        return;
      }

      if (!reaction.message.channel.isThread()) {
        return;
      }

      const config = await this.configRepository.getConfig(
        reaction.message.guildId
      );

      if (!config.forumChannelId) {
        return;
      }

      // Ignore unrelated threads
      if (reaction.message.channel.parentId !== config.forumChannelId) {
        return;
      }

      await this.reactionService.relayStaffReactionRemovalToUser(
        reaction.message.id,
        reaction.emoji.identifier
      );
    } catch (err) {
      this.logger.error(err, `Error handling staff reaction removal`);
    }
  }
}
