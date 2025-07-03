import { Message } from "discord.js";
import TextCommandHandler from "commands/CommandHandler";
import { SnippetService } from "services/SnippetService";
import { getLogger } from "utils/logger";
import { SnippetCommandView } from "views/SnippetCommandView";

export class ListSnippetsCommand extends TextCommandHandler {
  commandName = "snippet";
  subCommandName = "list";
  requiresPrimaryServer = true;

  aliases = ["all", "show"];

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

    try {
      const snippets = await this.snippetService.getAllSnippets(msg.guildId);

      if (snippets.length === 0) {
        await msg.reply(SnippetCommandView.noSnippets());
        return;
      }

      await msg.reply(SnippetCommandView.snippetList(snippets));
    } catch (error) {
      this.logger.error(`Error listing snippets: ${error}`);
      await msg.reply(SnippetCommandView.errorListingSnippets());
    }
  }
}
