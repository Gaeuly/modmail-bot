import type { Message, User } from "discord.js";
import TextCommandHandler from "./CommandHandler";
import type { ThreadService } from "services/ThreadService";
import type { MessageRelayService } from "services/MessageRelayService";
import { getLogger } from "utils/logger";
import { StaffThreadView } from "views/StaffThreadView";

export class ContactCommand extends TextCommandHandler {
  commandName = "contact";
  subCommandName = null;
  aliases = ["open"];
  requiresPrimaryServer = true;

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

    // Creates a new thread as staff to contact specific members
    const targetUserStr = args[0];

    // First check if mention
    let targetUser = msg.mentions.users.first();
    if (!targetUser) {
      // Then try to fetch user by ID / user resolveable
      targetUser = await msg.client.users.fetch(targetUserStr);
    }

    if (targetUser.bot) {
      await msg.channel.send("You cannot open a thread with a bot.");
    }

    const { thread, isNew } = await this.threadService.getOrCreateThread(
      targetUser.id,
      targetUser.username,
      true // force silent notification role
    );

    if (!isNew) {
      const content = `There's already a thread open with this user: ${thread.link}`;
      await msg.channel.send(content);

      return;
    }

    // Send a message to the staff to link the thread
    await msg.channel.send(`Created a new thread: ${thread.link}`);
  }
}
