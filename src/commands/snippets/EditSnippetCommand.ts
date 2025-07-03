import { Message } from "discord.js";
import TextCommandHandler from "commands/CommandHandler";
import { SnippetService } from "services/SnippetService";
import { getLogger } from "utils/logger";
import { SnippetCommandView } from "views/SnippetCommandView";

export class EditSnippetCommand extends TextCommandHandler {
  commandName = "snippet";
  subCommandName = "edit";
  requiresPrimaryServer = true;

  aliases = ["update", "modify"];

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

    // Need at least 2 arguments: name and content
    if (args.length < 2) {
      await msg.reply(SnippetCommandView.editUsage());
      return;
    }

    const name = args[0].toLowerCase();
    const content = args.slice(1).join(" ");

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

      // Update the snippet
      await this.snippetService.updateSnippet(msg.guildId, name, content);

      await msg.reply(SnippetCommandView.snippetUpdated(name, content));
    } catch (error) {
      this.logger.error(`Error updating snippet: ${error}`);
      await msg.reply(SnippetCommandView.errorUpdatingSnippet());
    }
  }
}
