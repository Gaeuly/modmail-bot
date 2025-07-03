import {
  ContainerBuilder,
  MessageFlags,
  SectionBuilder,
  TextDisplayBuilder,
  type MessageCreateOptions,
} from "discord.js";
import type { RelayUser } from "models/relayMessage";

export type NotificationType =
  | "join"
  | "leave"
  | "ban"
  | "unban"
  | "timeout"
  | "untimeout";

export class MemberNotificationView {
  static buildNotificationMessage(
    type: NotificationType,
    user: RelayUser,
    inPrimaryGuild: boolean,
    guildName: string,
    mutualServers: {
      id: string;
      name: string;
    }[],
    options?: { until?: Date }
  ): MessageCreateOptions {
    const container = new ContainerBuilder();

    let content = "";
    switch (type) {
      case "join":
        if (inPrimaryGuild) {
          content = `### User Joined the Server`;
        } else {
          content = `### User Joined Mutual Server - ${guildName}`;
        }

        break;
      case "leave":
        if (inPrimaryGuild) {
          content = `### User Left the Server`;

          if (mutualServers.length > 0) {
            const mutualServerNames = mutualServers
              .map((s) => `- ${s.name}`)
              .join("\n");

            content += `\nUser is still in mutual servers:`;
            content += `\n${mutualServerNames}`;
          }
        } else {
          content = `### User Left Mutual Server - ${guildName}`;
        }

        break;
      case "ban":
        if (inPrimaryGuild) {
          content = `### User Banned from the Server`;
          if (mutualServers.length > 0) {
            const mutualServerNames = mutualServers
              .map((s) => `- ${s.name}`)
              .join("\n");

            content += `\nUser is still in mutual servers:`;
            content += `\n${mutualServerNames}`;
          }
        } else {
          content = `### User Banned in Mutual Server - ${guildName}`;
        }

        break;
      case "unban":
        if (inPrimaryGuild) {
          content = `### User Unbanned from the Server`;
        } else {
          content = `### User Unbanned from Mutual Server - ${guildName}`;
        }

        break;
      case "timeout":
        if (inPrimaryGuild) {
          content = `### User Timed Out`;
        } else {
          content = `### User Timed Out in Mutual Server - ${guildName}`;
        }

        break;
      case "untimeout":
        if (inPrimaryGuild) {
          content = `### User Timeout Removed`;
        } else {
          content = `### User Timeout Removed in Mutual Server - ${guildName}`;
        }

        break;
      default:
        throw new Error(`Unknown notification type: ${type}`);
    }

    if (options?.until) {
      const timestamp = Math.floor(options.until.getTime() / 1000);

      content += `\n**Timed out until:** <t:${timestamp}:f>`;
      content += ` (<t:${timestamp}:R>)`;
    }

    const text = new TextDisplayBuilder().setContent(content);

    const section = new SectionBuilder()
      .setThumbnailAccessory((t) => t.setURL(user.displayAvatarURL()))
      .addTextDisplayComponents(text);

    container.addSectionComponents(section);

    return {
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] },
    };
  }
}
