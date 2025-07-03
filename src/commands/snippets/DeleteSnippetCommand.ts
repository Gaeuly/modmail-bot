import { Message } from "discord.js";
import TextCommandHandler from "commands/CommandHandler";
import { SnippetService } from "services/SnippetService";
import { getLogger } from "utils/logger";
import { SnippetCommandView } from "views/SnippetCommandView";

export class DeleteSnippetCommand extends TextCommandHandler {
  commandName = "snippet";
  subCommandName = "delete";
  requiresPrimaryServer = true;

  aliases = ["remove"];

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

    // Need 1 argument: name
    if (args.length < 1) {
      await msg.reply(SnippetCommandView.deleteUsage());
      return;
    }

    const name = args[0].toLowerCase();

    try {
      // Check if snippet exists
      const existingSnippet = await this.snippetService.getSnippet(
        msg.guildId,
        name
      );

      if (!existingSnippet) {
        await msg.reply(SnippetCommandView.snippetDoesNotExist(name));
        return;
      }

      // Delete the snippet
      const success = await this.snippetService.deleteSnippet(
        msg.guildId,
        name
      );

      if (success) {
        await msg.reply(SnippetCommandView.snippetDeleted(name));
      } else {
        await msg.reply(SnippetCommandView.snippetDeleteFailed(name));
      }
    } catch (error) {
      this.logger.error(`Error deleting snippet: ${error}`);
      await msg.reply(SnippetCommandView.errorDeletingSnippet());
    }
  }
}
