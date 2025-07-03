import {
  ChannelType,
  MessageReaction,
  User,
  type PartialMessageReaction,
  type PartialUser,
} from "discord.js";
import { getLogger } from "../utils/logger";
import type { LogService } from "../services/LogService";

export interface ReactionRelayService {
  relayUserReactionToStaff(
    userDmMessageId: string,
    userId: string,
    // Emoji unicode or custom emoji name, e.g. 👍 or emoji_name
    emojiName: string | null,
    // Represent emojis in message, e.g. <:emoji_name:emoji_id>
    emojiString: string,
    // Only if custom
    emojiUrl: string | null
  ): Promise<void>;
  relayUserReactionRemovalToStaff(
    userDmMessageId: string,
    userId: string,
    // Emoji unicode or custom emoji name, e.g. 👍 or emoji_name
    emojiName: string | null,
    // Represent emojis in message, e.g. <:emoji_name:emoji_id>
    emojiString: string,
    // Only if custom
    emojiUrl: string | null
  ): Promise<void>;
}

export class UserReactionController {
  private reactionService: ReactionRelayService;
  private logService: LogService;

  private logger = getLogger(this.constructor.name);

  constructor(reactionService: ReactionRelayService, logService: LogService) {
    this.reactionService = reactionService;
    this.logService = logService;
  }

  async handleUserDMReactionAdd(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
  ): Promise<void> {
    try {
      if (reaction.message.channel.type !== ChannelType.DM) {
        return;
      }

      await this.reactionService.relayUserReactionToStaff(
        reaction.message.id,
        user.id,
        reaction.emoji.name,
        reaction.emoji.toString(),
        reaction.emoji.imageURL()
      );
    } catch (err) {
      const contextMsg = `Error handling DM reaction from user ${
        user.tag || user.id
      }`;

      await this.logService.logError(err, contextMsg, this.constructor.name);
    }
  }

  async handleUserDMReactionRemove(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
  ): Promise<void> {
    try {
      if (reaction.message.channel.type !== ChannelType.DM) {
        return;
      }

      await this.reactionService.relayUserReactionRemovalToStaff(
        reaction.message.id,
        user.id,
        reaction.emoji.name,
        reaction.emoji.toString(),
        reaction.emoji.imageURL()
      );
    } catch (err) {
      const contextMsg = `Error handling DM reaction removal from user ${
        user.tag || user.id
      }`;

      await this.logService.logError(err, contextMsg, this.constructor.name);
    }
  }
}
