import { EmbedBuilder, type MessageCreateOptions } from "discord.js";
import { Snippet } from "../models/snippet.model";
import { Color } from "./Color";
import { quoteText } from "./util";

export class SnippetCommandView {
  static notInGuild(): MessageCreateOptions {
    const embed = new EmbedBuilder()
      .setDescription("This command can only be used in a server.")
      .setColor(Color.Pink);

    return {
      embeds: [embed],
      allowedMentions: { parse: [] },
    };
  }

  static addUsage(): MessageCreateOptions {
    const embed = new EmbedBuilder()
      .setDescription("Usage: `!snippet add <name> <content>`")
      .setColor(Color.Gray);

    return {
      embeds: [embed],
      allowedMentions: { parse: [] },
    };
  }

  static editUsage(): MessageCreateOptions {
    const embed = new EmbedBuilder()
      .setDescription("Usage: `!snippet edit <name> <new content>`")
      .setColor(Color.Gray);

    return {
      embeds: [embed],
      allowedMentions: { parse: [] },
    };
  }

  static deleteUsage(): MessageCreateOptions {
    const embed = new EmbedBuilder()
      .setDescription("Usage: `!snippet delete <name>`")
      .setColor(Color.Gray);

    return {
      embeds: [embed],
      allowedMentions: { parse: [] },
    };
  }

  static snippetAlreadyExists(name: string): MessageCreateOptions {
    const embed = new EmbedBuilder()
      .setDescription(
        `A snippet with the name \`${name}\` already exists. Use the update command to modify it.`
      )
      .setColor(Color.Pink);

    return {
      embeds: [embed],
      allowedMentions: { parse: [] },
    };
  }

  static snippetDoesNotExist(name: string): MessageCreateOptions {
    const embed = new EmbedBuilder()
      .setDescription(
        `No snippet with the name \`${name}\` exists. Use the add command to create a new snippet.`
      )
      .setColor(Color.Pink);

    return {
      embeds: [embed],
      allowedMentions: { parse: [] },
    };
  }

  static snippetAdded(name: string, content: string): MessageCreateOptions {
    const embed = new EmbedBuilder()
      .setDescription(`Successfully added snippet \`${name}\`.`)
      .addFields({
        name: "Content",
        value: content,
      })
      .setColor(Color.Blue);

    return {
      embeds: [embed],
      allowedMentions: { parse: [] },
    };
  }

  static snippetUpdated(name: string, content: string): MessageCreateOptions {
    const embed = new EmbedBuilder()
      .setDescription(`Successfully updated snippet \`${name}\`.`)
      .addFields({
        name: "Content",
        value: content,
      })
      .setColor(Color.Blue);

    return {
      embeds: [embed],
      allowedMentions: { parse: [] },
    };
  }

  static snippetDeleted(name: string): MessageCreateOptions {
    const embed = new EmbedBuilder()
      .setDescription(`Successfully deleted snippet \`${name}\`.`)
      .setColor(Color.Blue);

    return {
      embeds: [embed],
      allowedMentions: { parse: [] },
    };
  }

  static snippetDeleteFailed(name: string): MessageCreateOptions {
    const embed = new EmbedBuilder()
      .setDescription(`Failed to delete snippet \`${name}\`.`)
      .setColor(Color.Pink);

    return {
      embeds: [embed],
      allowedMentions: { parse: [] },
    };
  }

  static errorCreatingSnippet(): MessageCreateOptions {
    const embed = new EmbedBuilder()
      .setDescription(
        "Failed to create snippet. Please check the logs for details."
      )
      .setColor(Color.Pink);

    return {
      embeds: [embed],
      allowedMentions: { parse: [] },
    };
  }

  static errorUpdatingSnippet(): MessageCreateOptions {
    const embed = new EmbedBuilder()
      .setDescription(
        "Failed to update snippet. Please check the logs for details."
      )
      .setColor(Color.Pink);

    return {
      embeds: [embed],
      allowedMentions: { parse: [] },
    };
  }

  static errorDeletingSnippet(): MessageCreateOptions {
    const embed = new EmbedBuilder()
      .setDescription(
        "Failed to delete snippet. Please check the logs for details."
      )
      .setColor(Color.Pink);

    return {
      embeds: [embed],
      allowedMentions: { parse: [] },
    };
  }

  static errorListingSnippets(): MessageCreateOptions {
    const embed = new EmbedBuilder()
      .setDescription(
        "Failed to retrieve snippets. Please check the logs for details."
      )
      .setColor(Color.Pink);

    return {
      embeds: [embed],
      allowedMentions: { parse: [] },
    };
  }

  static noSnippets(): MessageCreateOptions {
    const embed = new EmbedBuilder()
      .setDescription("No snippets have been created for this server yet.")
      .setColor(Color.Gray);

    return {
      embeds: [embed],
      allowedMentions: { parse: [] },
    };
  }

  static snippetList(snippets: Snippet[]): MessageCreateOptions {
    const snippetStringItems = snippets.map((snippet) => {
      let s = `### \`${snippet.name}\``;
      s += "\n";

      // Add a > to the start of each line
      s += quoteText(snippet.content);

      return s;
    });

    const snippetString = snippetStringItems.join("\n");

    const embed = new EmbedBuilder()
      .setTitle("Available Snippets")
      .setColor(Color.Purple)
      .setDescription(snippetString)
      .setFooter({ text: `Total snippets: ${snippets.length}` });

    return { embeds: [embed], allowedMentions: { parse: [] } };
  }

  static getUsage(): MessageCreateOptions {
    const embed = new EmbedBuilder()
      .setDescription("Usage: `!snippet <name>`")
      .setColor(Color.Gray);

    return { embeds: [embed], allowedMentions: { parse: [] } };
  }

  static snippetContent(snippet: Snippet): MessageCreateOptions {
    const embed = new EmbedBuilder()
      .setTitle(`Snippet - \`${snippet.name}\``)
      .setDescription(quoteText(snippet.content))
      .setColor(Color.Blue);

    return { embeds: [embed], allowedMentions: { parse: [] } };
  }

  static errorFetchingSnippet(): MessageCreateOptions {
    const embed = new EmbedBuilder()
      .setDescription(
        "Failed to retrieve snippet. Please check the logs for details."
      )
      .setColor(Color.Pink);

    return { embeds: [embed], allowedMentions: { parse: [] } };
  }

  static snippetNameReserved(name: string): MessageCreateOptions {
    const embed = new EmbedBuilder()
      .setDescription(
        `The snippet name \`${name}\` is reserved and cannot be used. Please choose a different name.`
      )
      .setColor(Color.Pink);

    return {
      embeds: [embed],
      allowedMentions: { parse: [] },
    };
  }
}
