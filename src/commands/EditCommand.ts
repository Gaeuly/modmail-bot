import type { Message } from "discord.js";
import TextCommandHandler from "./CommandHandler";
import type { ThreadService } from "services/ThreadService";
import type { MessageRelayService } from "services/MessageRelayService";
import { getLogger } from "utils/logger";
import type { RuntimeConfig } from "models/runtimeConfig.model";

interface ConfigRepository {
  getConfig(guildId: string): Promise<RuntimeConfig>;
}

export class EditCommand extends TextCommandHandler {
  commandName = "edit";
  subCommandName = null;
  requiresPrimaryServer = false;

  aliases = ["e"];

  protected threadService: ThreadService;
  protected messageService: MessageRelayService;
  protected configRepository: ConfigRepository;

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

    // Check if the message is replying to another message
    const repliedToMessage = msg.reference?.messageId;
    if (!repliedToMessage) {
      await msg.channel.send(
        "To edit a message: Reply to a message with this command and your new message."
      );
      return;
    }

    const editContent = args.join(" ");
    if (!editContent) {
      await msg.channel.send("Please provide a new message content.");
      return;
    }

    try {
      // Get the message that was replied to
      const targetMessage = await msg.channel.messages.fetch(repliedToMessage);

      // Check if the message is from the bot
      if (targetMessage.author.id !== msg.client.user.id) {
        await msg.channel.send(
          "You can only edit staff messages. Make sure to reply to the bot message you want to edit."
        );

        return;
      }

      // Get thread information from the current channel
      const thread = await this.threadService.getThreadByChannelId(
        msg.channel.id
      );

      if (!thread) {
        await msg.channel.send(
          "Could not find the thread information... hmm... maybe this was a manually created forum thread?"
        );

        return;
      }

      if (thread.isClosed) {
        await msg.channel.send(
          "This thread is closed. Cannot edit messages in a closed thread."
        );
        return;
      }

      // Edit the message with the new content
      const result = await this.messageService.editStaffMessage(
        repliedToMessage,
        thread.userId,
        msg.guild,
        {
          id: msg.id,
          author: msg.author,
          // Set the new content for the message
          content: editContent,
          attachments: Array.from(msg.attachments.values()),
          stickers: Array.from(msg.stickers.values()),
          forwarded: false,
          createdTimestamp: msg.createdTimestamp,
        }
      );

      if (!result.ok) {
        await msg.channel.send(result.message);

        return;
      }

      // React to the command message to indicate success
      await msg.react("✅");
    } catch (error) {
      this.logger.error(`Error editing message: ${error}`);
      await msg.channel.send("Failed to edit message. See logs for details.");
    }
  }
}
