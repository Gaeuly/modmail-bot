import {
  ContainerBuilder,
  EmbedBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SeparatorBuilder,
  TextDisplayBuilder,
  type ImageURLOptions,
  type MessageCreateOptions,
} from "discord.js";
import {
  defaultStaffMessageOptions,
  type StaffMessageOptions,
} from "services/MessageRelayService";
import { Color, HexColor } from "./Color";
import type {
  StaffRelayMessage,
  StaffToUserMessage,
  StaffToUserMessageEdit,
} from "../models/relayMessage";

export interface UserThreadViewGuild {
  name: string;
  iconURL(options?: ImageURLOptions): string | null;
}

export interface UserThreadViewUser {
  tag: string;
  displayAvatarURL(): string;
}

export class UserThreadView {
  static initialMessage(
    guild: UserThreadViewGuild,
    message: string
  ): MessageCreateOptions {
    const embed = new EmbedBuilder()
      .setAuthor({
        name: guild.name,
        iconURL: guild.iconURL() || undefined,
      })
      .setDescription(message)
      .setColor(Color.Gray)
      .setFooter({
        text: "Automated message",
      })
      .setTimestamp();

    return {
      embeds: [embed],
    };
  }

  static async staffMessage(
    guild: UserThreadViewGuild,
    msg: StaffRelayMessage,
    options: StaffMessageOptions = defaultStaffMessageOptions
  ): Promise<MessageCreateOptions> {
    if (options.plainText) {
      let content = "";
      if (options.anonymous) {
        content = `### Message from ${guild.name}**`;
      } else {
        content = `### Message from ${guild.name} - ${msg.author.username}`;
      }

      if (msg.content) {
        content += `\n${msg.content}`;
      }

      if (msg.attachments.length > 0) {
        content += "\n#### Attachments\n";
        content += msg.attachments
          .map((attachment) => {
            if (typeof attachment === "string") {
              return attachment;
            }

            return `[${attachment.name}](${attachment.url})`;
          })
          .join("\n");
      }

      if (msg.stickers.length > 0) {
        content += "\n#### Stickers\n";
        content += msg.stickers
          .map((sticker) => `[${sticker.name}](${sticker.url})`)
          .join("\n");
      }

      return {
        content: msg.content,
      };
    }

    const container = new ContainerBuilder().setAccentColor(HexColor.Blue);

    let authorText = "";
    if (options.anonymous) {
      authorText = `### Message from ${guild.name}`;
    } else {
      authorText = `### Message from ${guild.name} - ${msg.author.username}`;
    }

    const authorTextComponent = new TextDisplayBuilder().setContent(authorText);
    container.addTextDisplayComponents(authorTextComponent);

    if (msg.content) {
      container.addSeparatorComponents(new SeparatorBuilder());
      const contentText = new TextDisplayBuilder().setContent(msg.content);
      container.addTextDisplayComponents(contentText);
    }

    if (msg.attachments.length > 0) {
      container.addSeparatorComponents(new SeparatorBuilder());
      const attachmentItems = msg.attachments.map((attachment) => {
        if (typeof attachment === "string") {
          return new MediaGalleryItemBuilder().setURL(attachment);
        }

        return new MediaGalleryItemBuilder().setURL(attachment.url);
      });
      const attachmentText = new MediaGalleryBuilder().addItems(
        attachmentItems
      );

      container.addMediaGalleryComponents(attachmentText);
    }

    if (msg.stickers.length > 0) {
      container.addSeparatorComponents(new SeparatorBuilder());
      const stickerItems = msg.stickers.map((sticker) =>
        new MediaGalleryItemBuilder()
          .setURL(sticker.url)
          .setDescription(sticker.name)
      );
      const stickerText = new MediaGalleryBuilder().addItems(stickerItems);

      container.addMediaGalleryComponents(stickerText);
    }

    return {
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] },
    };
  }
}
