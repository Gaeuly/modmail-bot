import {
  ContainerBuilder,
  MessageFlags,
  TextDisplayBuilder,
  type MessageCreateOptions,
} from "discord.js";
import { HexColor } from "./Color";

export class CommandErrorView {
  static primaryServerOnlyError(
    primaryGuildName: string,
    primaryGuildId: string
  ): MessageCreateOptions {
    const container = new ContainerBuilder().setAccentColor(HexColor.Pink);

    const errorContent = [
      `## Wrong server!`,
      `\nThis command can only be used in the **primary server** where modmail threads are created.`,
      `\n\n**Current Primary server**`,
      `\n${primaryGuildName}`,
      `\nID: \`${primaryGuildId}\``,
      `\n\nIf you want this server to be primary, please notify the bot owner to change the primary server ID.`,
    ];

    const text = new TextDisplayBuilder().setContent(errorContent.join(""));

    container.addTextDisplayComponents(text);

    return {
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] },
    };
  }
}
