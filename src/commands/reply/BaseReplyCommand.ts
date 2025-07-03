import {
  DiscordAPIError,
  MessageFlags,
  RESTJSONErrorCodes,
  type Message,
} from "discord.js";
import TextCommandHandler from "../CommandHandler";
import type { ThreadService } from "services/ThreadService";
import type {
  MessageRelayService,
  StaffMessageOptions,
} from "services/MessageRelayService";
import { getLogger } from "utils/logger";
import type { RuntimeConfig } from "models/runtimeConfig.model";

interface ConfigRepository {
  getConfig(guildId: string): Promise<RuntimeConfig>;
}

export abstract class BaseReplyCommand extends TextCommandHandler {
  requiresPrimaryServer = false;

  protected threadService: ThreadService;
  protected messageService: MessageRelayService;

  protected configRepository: ConfigRepository;

  protected abstract replyOptions: StaffMessageOptions;

  protected logger = getLogger(this.constructor.name);

  constructor(
    threadService: ThreadService,
    messageService: MessageRelayService,
    configRepository: ConfigRepository
  ) {
    super();

    this.threadService = threadService;
    this.messageService = messageService;
    this.configRepository = configRepository;
  }

  async handler(msg: Message, args: string[]): Promise<void> {
    if (!msg.inGuild()) {
      return;
    }

    const config = await this.configRepository.getConfig(msg.guildId);

    if (!config.forumChannelId) {
      await msg.channel.send(
        "Not configured yet! Please set up the modmail forum channel first."
      );

      return;
    }

    // Check if the message is in a modmail thread
    if (msg.channel.parentId !== config.forumChannelId) {
      return;
    }

    const replyContent = args.join(" ");
    // If ALL are empty, return
    if (
      !replyContent &&
      msg.attachments.size === 0 &&
      msg.stickers.size === 0
    ) {
      await msg.channel.send(
        "Please provide a message or attachment to reply with."
      );
      return;
    }

    // Get thread information from the current channel
    const thread = await this.threadService.getThreadByChannelId(
      msg.channel.id
    );

    if (!thread) {
      await msg.channel.send(
        "This command can only be used in a modmail thread channel."
      );
      return;
    }

    if (thread.isClosed) {
      await msg.channel.send(
        "This thread is closed and cannot be replied to. Open a new thread to continue."
      );

      // Re-lock -- should always be a thread from the check above, but need type check
      if (msg.channel.isThread()) {
        await msg.channel.edit({
          locked: true,
          archived: true,
        });
      }

      return;
    }

    try {
      // Send the reply to the user
      await this.messageService.relayStaffMessageToUser(
        msg.channelId,
        thread.userId,
        msg.guild,
        {
          id: msg.id,
          author: msg.author,
          // Update message content to be the reply only, not full command
          content: replyContent,
          attachments: Array.from(msg.attachments.values()),
          stickers: Array.from(msg.stickers.values()),
          forwarded: false,
          createdTimestamp: msg.createdTimestamp,
        },
        this.replyOptions
      );

      // TODO: Clear error for if bot missing MANAGE_MESSAGES permission
      try {
        await msg.delete();
      } catch (err) {
        if (
          err instanceof DiscordAPIError &&
          err.code === RESTJSONErrorCodes.MissingPermissions
        ) {
          await msg.channel.send(
            "If you want the original reply commands to be automatically deleted, please ensure I have the `Manage Messages` permission in this channel."
          );
        }

        this.logger.error(
          `Error deleting command message: ${err} -- ${msg.content}`
        );
      }
    } catch (error) {
      this.logger.error(`Error sending reply: ${error}`);

      await msg.channel.send(
        "Error while sending reply. See logs for details."
      );
    }
  }
}
