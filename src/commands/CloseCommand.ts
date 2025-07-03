import type { Message } from "discord.js";
import TextCommandHandler from "./CommandHandler";
import type { ThreadService } from "services/ThreadService";
import { getLogger } from "utils/logger";
import type { RuntimeConfig } from "models/runtimeConfig.model";

interface ConfigRepository {
  getConfig(guildId: string): Promise<RuntimeConfig>;
}

export class CloseCommand extends TextCommandHandler {
  commandName = "close";
  subCommandName = null;
  aliases = ["c"];
  requiresPrimaryServer = false;

  private threadService: ThreadService;
  private configRepository: ConfigRepository;

  private logger = getLogger("CloseCommand");

  constructor(
    threadService: ThreadService,
    configRepository: ConfigRepository
  ) {
    super();

    this.threadService = threadService;
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
    if (
      !msg.channel.isThread() ||
      msg.channel.parentId !== config.forumChannelId
    ) {
      await msg.channel.send(
        "This command can only be used in a modmail thread channel."
      );

      return;
    }

    // Get thread information from the current channel
    const thread = await this.threadService.getThreadByChannelId(
      msg.channel.id
    );

    if (!thread) {
      await msg.channel.send(
        "Hmm... couldn't find the thread information, maybe this was a manually created forum thread."
      );

      return;
    }

    if (thread.isClosed) {
      await msg.channel.send("This thread is already closed.");

      await msg.channel.edit({
        locked: true,
        archived: true,
      });

      return;
    }

    try {
      // Parse optional close reason from remaining arguments
      const closeReason = args.length > 0 ? args.join(" ") : undefined;

      // Close the thread
      await this.threadService.closeThread(thread, msg.author.id, closeReason);
    } catch (error) {
      this.logger.error(`Error closing thread: ${error}`);

      await msg.channel.send(
        "Failed to close the thread. See logs for details."
      );
    }
  }
}
