import type { Message } from "discord.js";
import TextCommandHandler from "./CommandHandler";
import type { ThreadService } from "services/ThreadService";
import type { MessageRelayService } from "services/MessageRelayService";
import { getLogger } from "utils/logger";
import { StaffThreadView } from "views/StaffThreadView";

export class DeleteCommand extends TextCommandHandler {
  commandName = "delete";
  subCommandName = null;
  requiresPrimaryServer = false;

  aliases = ["d"];

  protected threadService: ThreadService;
  protected messageService: MessageRelayService;

  protected logger = getLogger(this.constructor.name);

  constructor(
    threadService: ThreadService,
    messageService: MessageRelayService
  ) {
    super();
    this.threadService = threadService;
    this.messageService = messageService;
  }

  async handler(msg: Message, args: string[]): Promise<void> {
    if (!msg.inGuild()) {
      return;
    }

    // Check if the message is replying to another message
    const repliedToMessage = msg.reference?.messageId;
    if (!repliedToMessage) {
      await msg.channel.send(
        "Reply to a message with this command to delete it."
      );

      return;
    }

    try {
      // Get the message that was replied to
      const targetMessage = await msg.channel.messages.fetch(repliedToMessage);

      // Check if the message is from bot self
      if (targetMessage.author.id !== msg.client.user.id) {
        await msg.channel.send(
          "You can only delete staff messages. Make sure to reply to the bot message you want to delete."
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
          "This thread is closed. Cannot delete messages in a closed thread."
        );

        return;
      }

      // Delete the message to the user
      const result = await this.messageService.deleteStaffMessage(
        thread.userId,
        repliedToMessage,
        msg.author.id
      );

      if (!result.ok) {
        await msg.channel.send(result.message);

        return;
      }

      // React to the message with a checkmark
      await msg.react("✅");
    } catch (error) {
      this.logger.error(`Error deleting message: ${error}`);

      await msg.channel.send("Failed to delete message. See logs for details.");
    }
  }
}
