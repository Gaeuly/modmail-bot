import type { Message } from "discord.js";
import TextCommandHandler from "./CommandHandler";
import { getLogger } from "utils/logger";
import { HelpCommandView } from "views/HelpView";
import type { BotConfig } from "models/botConfig.model";

export class HelpCommand extends TextCommandHandler {
  commandName = "help";
  subCommandName = null;
  aliases = [];
  requiresPrimaryServer = false;

  private logger = getLogger(this.constructor.name);
  private config: BotConfig;

  constructor(config: BotConfig) {
    super();
    this.config = config;
  }

  async handler(msg: Message, args: string[]): Promise<void> {
    if (!msg.inGuild()) {
      return;
    }

    const helpMsg = HelpCommandView.help(this.config);
    await msg.reply(helpMsg);
  }
}
