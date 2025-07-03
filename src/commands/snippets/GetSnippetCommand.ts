import { Message } from "discord.js";
import TextCommandHandler from "commands/CommandHandler";
import { SnippetService } from "services/SnippetService";
import { getLogger } from "utils/logger";
import { SnippetCommandView } from "views/SnippetCommandView";

export class GetSnippetCommand extends TextCommandHandler {
  commandName = "snippet";
  subCommandName = null;
  requiresPrimaryServer = true;
  aliases = [];

  private snippetService: SnippetService;
  private logger = getLogger(this.constructor.name);

  constructor(snippetService: SnippetService) {
    super();
    this.snippetService = snippetService;
  }

  async handler(msg: Message, args: string[]): Promise<void> {
    if (!msg.inGuild()) {
      await msg.reply(SnippetCommandView.notInGuild());
      return;
    }

    if (args.length < 1) {
      await msg.reply(SnippetCommandView.getUsage());
      return;
    }

    const name = args[0].toLowerCase();

    try {
      const snippet = await this.snippetService.getSnippet(msg.guildId, name);

      if (!snippet) {
        await msg.reply(SnippetCommandView.snippetDoesNotExist(name));
        return;
      }

      await msg.reply(SnippetCommandView.snippetContent(snippet));
    } catch (error) {
      this.logger.error(`Error fetching snippet: ${error}`);
      await msg.reply(SnippetCommandView.errorFetchingSnippet());
    }
  }
}
