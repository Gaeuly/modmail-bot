import {
  ContainerBuilder,
  MessageFlags,
  TextDisplayBuilder,
  type MessageCreateOptions,
} from "discord.js";
import { HexColor } from "./Color";
import type { BotConfig } from "models/botConfig.model";

export class HelpCommandView {
  static help(config: BotConfig): MessageCreateOptions {
    const container = new ContainerBuilder().setAccentColor(HexColor.Blue);

    const helpContent = [
      `# Bot Commands`,

      `\n## General Commands`,
      `\n\`help\` - Show this help message`,
      `\n\`settings\` - Show settings menu`,

      `\n## Thread Commands`,
      `\n\`contact\` - Open a new thread with a user`,
      `\n\`reply\` - Reply to a thread`,
      `\n\`areply\` - Anonymously reply to a thread`,
      `\n\`preply\` - Plain text reply to a thread`,
      `\n\`apreply\` - Anonymous plain text reply to a thread`,
      `\n\`edit\` - Edit a previous thread message, reply to the message you want to edit`,
      `\n\`delete\` - Delete a previous thread message, reply to the message you want to delete`,
      `\n\`close [optional message]\` - Close the current thread, optionally providing staff-only reason for closure`,

      `\n## User Information`,
      `\n\`logs\` - Links to previous threads by the same user`,

      `\n## Snippets`,
      `\n\`snippet add [name] [content]\` - Create a new snippet`,
      `\n\`snippet edit [name] [content]\` - Modify an existing snippet`,
      `\n\`snippet [name]\` - Show a snippet's content`,
      `\n\`snippet list\` - List all available snippets`,
      `\n\`snippet delete [name]\` - Delete a snippet`,

      `\n## Guides`,
      `\n- [Setup guide](https://github.com/sushiibot/sushii-modmail/blob/main/docs/SETUP_GUIDE.md)`,
      `\n- [Staff guide](https://github.com/sushiibot/sushii-modmail/blob/main/docs/USER_GUIDE.md)`,
    ];

    if (config.gitHash || config.buildDate) {
      const hash = config.gitHash ? config.gitHash.slice(0, 7) : "unknown";
      const date = config.buildDate
        ? `<t:${Math.floor(config.buildDate.getTime() / 1000)}:f>`
        : "unknown";
      helpContent.push(`\n\n-# Bot Version: \`${hash}\` - ${date}`);
    }

    const text = new TextDisplayBuilder().setContent(helpContent.join(""));

    container.addTextDisplayComponents(text);

    return {
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] },
    };
  }
}
