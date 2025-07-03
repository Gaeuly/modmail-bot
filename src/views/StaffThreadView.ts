import {
  AttachmentBuilder,
  Collection,
  ContainerBuilder,
  EmbedBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  type BaseMessageOptions,
  type GuildForumThreadCreateOptions,
  type MessageCreateOptions,
  type MessageMentionOptions,
} from "discord.js";
import { Thread } from "../models/thread.model";
import {
  defaultStaffMessageOptions,
  type StaffMessageOptions,
} from "services/MessageRelayService";
import { formatUserIdentity } from "./user";
import { Color, HexColor } from "./Color";
import { downloadAttachments, quoteText } from "./util";
import type {
  UserToStaffMessage,
  StaffRelayMessage,
} from "../models/relayMessage";
import type { BotEmojiName, MessageEmojiMap } from "models/botEmoji.model";
import type { MessageVersion } from "models/messageVersion.model";

export const MediaGalleryAttachmentsID = 101;
export const MediaGalleryStickersID = 102;

const MAX_MESSAGE_LENGTH = 4000;

export const StaffThreadEmojis = [
  "message_id",
  "user",
  "forward",
  "edit",
  "delete",
  "snippet",
  "plain_text",
  "arrow_down_right",
  "clock",
] as const satisfies readonly BotEmojiName[];

export type StaffThreadEmojis = MessageEmojiMap<typeof StaffThreadEmojis>;

interface MemberRole {
  id: string;
  rawPosition: number;
}

interface User {
  id: string;
  displayName: string;
  username: string;
  displayAvatarURL(): string;
}

interface UserThreadInfo {
  user: User & {
    createdTimestamp: number;
  };
  member: {
    roles: {
      cache: Collection<string, MemberRole>;
    };
    joinedTimestamp: number | null;
    nickname: string | null;
    avatarURL(): string | null;
  } | null;
  mutualGuilds?: { id: string; name: string }[];
  previousThreads?: Thread[];
}

export class StaffThreadView {
  /**
   * Generates the initial message for a new modmail thread
   */
  static initialThreadMessage(
    emojis: StaffThreadEmojis,
    userInfo: UserThreadInfo,
    notificationRoleId: string | null,
    silent: boolean,
    manuallyCreated?: boolean
  ): MessageCreateOptions {
    const container = new ContainerBuilder().setAccentColor(HexColor.Gray);

    let content = `### Modmail Thread`;

    // Basic info
    content += `\n${emojis.user} <@${userInfo.user.id}>`;
    content += `\n${emojis.user} Username: \`${userInfo.user.username}\``;
    content += `\n${emojis.arrow_down_right} User ID: \`${userInfo.user.id}\``;
    if (userInfo.member?.nickname) {
      content += `\n${emojis.arrow_down_right} Server Nickname: \`${userInfo.member.nickname}\``;
    }

    // Timestamps
    const createdTs = Math.floor(userInfo.user.createdTimestamp / 1000);
    content += `\n${emojis.arrow_down_right} Created Account: <t:${createdTs}:R>`;

    if (userInfo.member?.joinedTimestamp) {
      const joinedTs = Math.floor(userInfo.member.joinedTimestamp / 1000);

      content += `\n${emojis.arrow_down_right} Joined Server: <t:${joinedTs}:R>`;
    }

    // Roles
    if (userInfo.member) {
      content += `\n### Roles`;

      const roles = Array.from(userInfo.member.roles.cache.values())
        .sort((a, b) => b.rawPosition - a.rawPosition)
        .map((role) => `<@&${role.id}>`);

      content += `\n${roles.join(", ") || "None"}`;
    }

    // Mutual servers
    if (userInfo.mutualGuilds) {
      content += `\n### Mutual Servers`;

      const mutualServers = userInfo.mutualGuilds.map((g) => g.name).join("\n");

      content += `\n${mutualServers || "None"}`;
    }

    // Previous threads
    if (userInfo.previousThreads) {
      content += `\n### Previous Threads`;
      const previousThreads = userInfo.previousThreads
        .map((thread) => thread.toString())
        .join("\n");
      content += `\n${previousThreads || "None"}`;
    }

    const userinfoText = new TextDisplayBuilder().setContent(content);

    const userinfoSection = new SectionBuilder()
      .setThumbnailAccessory((t) => t.setURL(userInfo.user.displayAvatarURL()))
      .addTextDisplayComponents(userinfoText);

    container.addSectionComponents(userinfoSection);

    // Add the ping
    if (notificationRoleId) {
      container.addSeparatorComponents(new SeparatorBuilder());

      let notificationContent = `-# Notification role: <@&${notificationRoleId}>`;
      if (silent) {
        notificationContent += ` (silent)`;
      } else if (manuallyCreated) {
        // Don't double say it's silent, only say this if it's not already
        // silent AND manually created.
        notificationContent += ` (silent because this thread was manually created)`;
      }

      const notificationText = new TextDisplayBuilder().setContent(
        notificationContent
      );

      container.addTextDisplayComponents(notificationText);
    }

    const allowedMentions: MessageMentionOptions = {
      parse: [],
    };

    if (notificationRoleId) {
      allowedMentions.roles = [notificationRoleId];
      allowedMentions.parse = undefined;
    }

    if (silent || manuallyCreated) {
      return {
        components: [container],
        flags: [
          MessageFlags.IsComponentsV2,
          // Silent notification
          MessageFlags.SuppressNotifications,
        ],
        allowedMentions,
      };
    }

    return {
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions,
    };
  }

  /**
   * Generates the thread metadata (name, etc.)
   */
  static createThreadOptions(
    userId: string,
    username: string
  ): Omit<GuildForumThreadCreateOptions, "message"> {
    return {
      // Need user ID in the thread name to allow searching by ID
      name: `${username} - ${userId}`,
      reason: `New ModMail from ${userId}`,
    };
  }

  /**
   * Formats a list of threads for display
   * @param threads Array of threads to format
   * @returns Formatted string with thread information
   */
  static formatThreadList(threads: Thread[]): MessageCreateOptions {
    if (threads.length === 0) {
      return { content: "No previous threads found for this user." };
    }

    // Format each thread with additional information
    const threadLinks = threads.map((thread) => thread.toString()).join("\n");

    const embed = new EmbedBuilder()
      .setTitle("Previous user threads")
      .setDescription(threadLinks)
      .setColor(Color.Gray);

    return {
      embeds: [embed],
    };
  }

  static staffReplyComponents(
    msg: StaffRelayMessage,
    emojis: StaffThreadEmojis,
    options: StaffMessageOptions = defaultStaffMessageOptions,
    displayOptions: {
      editedById?: string;
      deletedById?: string;
      failed?: boolean; // If failed to send due to DM permissions
    } = {}
  ): BaseMessageOptions["components"] {
    const container = new ContainerBuilder();

    if (displayOptions.deletedById) {
      container.setAccentColor(HexColor.Gray);
    } else {
      container.setAccentColor(HexColor.Green);
    }

    if (displayOptions.failed) {
      container.setAccentColor(HexColor.Gray);
    }

    // Set the author field based on anonymous option
    let authorName = `###`;

    if (displayOptions.failed) {
      authorName += ` [Failed to send message]`;
    }

    authorName += ` Staff - ${msg.author.username}`;
    if (options.anonymous) {
      authorName += " (Anonymous)";
    }

    const authorText = new TextDisplayBuilder().setContent(authorName);
    container.addTextDisplayComponents(authorText);

    // Add content
    if (msg.content) {
      container.addSeparatorComponents(new SeparatorBuilder());
      const contentText = new TextDisplayBuilder().setContent(msg.content);
      container.addTextDisplayComponents(contentText);
    }

    // Add attachments
    if (msg.attachments.length > 0) {
      container.addSeparatorComponents(new SeparatorBuilder());

      const attachmentItems = msg.attachments.map(
        // Reference re-uploaded files
        (attachment) => {
          if (typeof attachment === "string") {
            return new MediaGalleryItemBuilder().setURL(attachment);
          }

          // This is a re-uploaded attachment, bot downloads original attachment
          // and re-uploads as an attachment.
          return new MediaGalleryItemBuilder().setURL(
            `attachment://${attachment.name}`
          );
        }
      );
      const attachmentText = new MediaGalleryBuilder()
        .setId(MediaGalleryAttachmentsID)
        .addItems(attachmentItems);

      container.addMediaGalleryComponents(attachmentText);
    }

    // Add stickers
    if (msg.stickers.length > 0) {
      container.addSeparatorComponents(new SeparatorBuilder());

      const stickerItems = msg.stickers.map((sticker) => {
        return new MediaGalleryItemBuilder()
          .setURL(sticker.url)
          .setDescription(sticker.name);
      });
      const stickerText = new MediaGalleryBuilder()
        .setId(MediaGalleryStickersID)
        .addItems(stickerItems);

      container.addMediaGalleryComponents(stickerText);
    }

    // Add metadata
    let metadataStr = "\n";

    if (displayOptions.editedById) {
      metadataStr += `\n${emojis.edit} Edited by <@${displayOptions.editedById}>`;
    }

    if (displayOptions.deletedById) {
      metadataStr += `\n${emojis.delete} Deleted by <@${displayOptions.deletedById}>`;
    }

    if (options.plainText) {
      metadataStr += `\n${emojis.plain_text} Sent as plain text`;
    }

    if (options.snippet) {
      const name = options.snippetName ? ` \`${options.snippetName}\`` : "";
      metadataStr += `\n${emojis.snippet} Sent from snippet${name}`;
    }

    // Add user ID
    metadataStr += `\n${emojis.user} Staff User ID: \`${msg.author.id}\``;

    // Add Discord timestamp
    const messageTimestamp = Math.floor(msg.createdTimestamp / 1000);
    metadataStr += `\n${emojis.clock} Message sent <t:${messageTimestamp}:R> — <t:${messageTimestamp}:f>`;

    // Only add if there's content
    if (metadataStr.trim().length > 1) {
      container.addSeparatorComponents(new SeparatorBuilder());
      const metadataText = new TextDisplayBuilder().setContent(metadataStr);
      container.addTextDisplayComponents(metadataText);
    }

    return [container];
  }

  static systemMessage(
    content: string,
    options: {
      automated: boolean;
    } = { automated: true }
  ): MessageCreateOptions {
    const container = new ContainerBuilder();

    let textDisplayContent = `### System`;
    if (options.automated) {
      textDisplayContent += " (Automated)";
    }

    textDisplayContent += `\n${content}`;

    const contentText = new TextDisplayBuilder().setContent(textDisplayContent);
    container.addTextDisplayComponents(contentText);

    return {
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: {
        parse: [],
      },
    };
  }

  static userDMsDisabledError(): MessageCreateOptions {
    const container = new ContainerBuilder().setAccentColor(HexColor.Pink);

    let content = "## Cannot message user";
    content += `\nThe user has either blocked the bot or their privacy settings don't allow DMs from server members.`;

    const textDisplay = new TextDisplayBuilder().setContent(content);

    container.addTextDisplayComponents(textDisplay);

    return {
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: {
        parse: [],
      },
    };
  }

  static userReplyDeletedMessage(
    messageId: string,
    previousMessageId?: string
  ): MessageCreateOptions {
    const embed = new EmbedBuilder()
      .setTitle("Message deleted")
      .setDescription(`Message ID: ${messageId}`)
      .setColor(Color.Purple)
      .setTimestamp();

    const msg: MessageCreateOptions = {
      embeds: [embed],
    };

    if (previousMessageId) {
      msg.reply = {
        messageReference: previousMessageId,
      };
    }

    return msg;
  }

  /**
   * Creates v2 components for a user reply message, created or edited. Message
   * edits can only change the content, so attachments and stickers are excluded
   * when isEdited is true.
   *
   * @param userMessage
   * @param attachments
   * @param isEdited
   * @returns
   */
  static userReplyComponents(
    userMessage: UserToStaffMessage,
    attachments: AttachmentBuilder[],
    messageVersions: MessageVersion[],
    isEdited: boolean,
    emojis: StaffThreadEmojis
  ): BaseMessageOptions["components"][] {
    const primaryContainer = new ContainerBuilder();

    // This will currently only be: empty OR 1 additional message with edits.
    const additionalMessages = [];

    if (isEdited) {
      primaryContainer.setAccentColor(HexColor.Purple);
    } else {
      primaryContainer.setAccentColor(HexColor.Blue);
    }

    // 1. Author
    // 2. Content
    // 3. Attachments, stickers
    // 4. Metadata (links to attachments, stickers, timestamps, ID)

    const authorContentSection = new SectionBuilder().setThumbnailAccessory(
      (t) => t.setURL(userMessage.author.displayAvatarURL())
    );

    // 1. Author
    let authorAndContent = `### User - ${userMessage.author.username}`;

    // 2. Content - ADD to existing author section (optional)
    // So the thumbnail is next to the content instead of pushing it down.
    if (userMessage.content) {
      authorAndContent += `\n${userMessage.content}`;
    }

    const authorAndContentText = new TextDisplayBuilder().setContent(
      authorAndContent
    );

    // Add the text to section
    authorContentSection.addTextDisplayComponents(authorAndContentText);

    //primaryContainer.addTextDisplayComponents(authorText);
    // Add the section to the container
    primaryContainer.addSectionComponents(authorContentSection);

    if (messageVersions.length > 0) {
      primaryContainer.addSeparatorComponents(new SeparatorBuilder());

      const editHistoryItems = messageVersions.map((version) => {
        const editTs = Math.floor(version.editedAt.getTime() / 1000);
        let s = `<t:${editTs}:f>`;
        s += `\n${quoteText(version.content)}`;

        return s;
      });

      let editHistoryText = `### Message Edits`;
      editHistoryText += `\n${editHistoryItems.join("\n")}`;

      // Check if current content + edit history exceeds max length
      if (
        userMessage.content.length + editHistoryText.length >
        MAX_MESSAGE_LENGTH
      ) {
        // If it does, replace this logic to use a dedicated message for edits
        const additionalMsg = this.userReplyComponentsAdditionalEdits(
          messageVersions,
          emojis
        );

        additionalMessages.push(additionalMsg);
      } else {
        // Fine to continue with the primary message
        const editTextDisplay = new TextDisplayBuilder().setContent(
          editHistoryText
        );

        primaryContainer.addTextDisplayComponents(editTextDisplay);
      }
    }

    // 3. Attachments - use reuploaded attachments
    if (!isEdited && attachments.length > 0) {
      primaryContainer.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large)
      );

      const attachmentItems = attachments.map((attachment) =>
        // Reference file attachments
        new MediaGalleryItemBuilder().setURL(`attachment://` + attachment.name)
      );
      const attachmentText = new MediaGalleryBuilder().addItems(
        attachmentItems
      );

      primaryContainer.addMediaGalleryComponents(attachmentText);
    }

    if (userMessage.stickers.length > 0) {
      primaryContainer.addSeparatorComponents(new SeparatorBuilder());

      const stickerItems = userMessage.stickers.map((sticker) =>
        new MediaGalleryItemBuilder()
          .setURL(sticker.url)
          .setDescription(sticker.name)
      );
      const stickerText = new MediaGalleryBuilder().addItems(stickerItems);

      primaryContainer.addMediaGalleryComponents(stickerText);
    }

    // 4. Metadata
    primaryContainer.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large)
    );

    let metadataStr = "";

    if (!isEdited && userMessage.attachments.length > 0) {
      const attachmentLinks = userMessage.attachments
        .map((attachment) => `> [${attachment.name}](${attachment.url})`)
        .join("\n");

      metadataStr += `\n**Original Attachment links**`;
      metadataStr += `\n${attachmentLinks}`;
    }

    if (!isEdited && userMessage.stickers.length > 0) {
      const stickerLinks = userMessage.stickers
        .map((sticker) => `[${sticker.name}](${sticker.url})`)
        .join("\n");

      metadataStr += `\n**Stickers:**`;
      metadataStr += `\n${stickerLinks}`;
    }

    if (userMessage.forwarded === true) {
      metadataStr += `\n\n${emojis.forward} Forwarded message`;
    }

    metadataStr += `\n${emojis.user} User ID: \`${userMessage.author.id}\``;

    // Add message timestamp
    const messageTimestamp = Math.floor(userMessage.createdTimestamp / 1000);
    metadataStr += `\n${emojis.clock} Message sent <t:${messageTimestamp}:R> — <t:${messageTimestamp}:f>`;

    const metadataText = new TextDisplayBuilder().setContent(metadataStr);
    primaryContainer.addTextDisplayComponents(metadataText);

    // Primary + any additional messages
    return [[primaryContainer], ...additionalMessages];
  }

  /**
   * Creates a v2 components dedicated to edits only. Any older edits that
   * cause it to exceed 4_000 characters will cause it to currently just omit
   * the oldest edits. Since it's unlikely that a very large message will be
   * edited so many times, it's an edge case that isn't worth making it overly
   * complex.
   *
   * This is only used if the primary message exceeds the maximum length to
   * contain both the current message and previous edit history.
   */
  static userReplyComponentsAdditionalEdits(
    messageVersions: MessageVersion[],
    emojis: StaffThreadEmojis
  ): BaseMessageOptions["components"] {
    if (messageVersions.length === 0) {
      return [];
    }

    const container = new ContainerBuilder().setAccentColor(HexColor.Purple);

    const editHistoryItems = messageVersions.map((version) => {
      const editTs = Math.floor(version.editedAt.getTime() / 1000);
      let s = `<t:${editTs}:f>`;
      s += `\n${quoteText(version.content)}`;

      return s;
    });

    let editHistoryText = `### Extended Message Edit History`;
    editHistoryText += `\n`;

    for (const item of editHistoryItems) {
      // If the edit history exceeds 4_000 characters (with some buffer), stop
      // adding more edits. Last ones are the oldest ones?

      // TODO: There is a small edge case where if they really completely max out
      // the 40000 character limit, the additional title will cause it to exceed
      // the limit, but it's unlikely.
      if (editHistoryText.length + item.length > 4000 - 100) {
        break;
      }

      editHistoryText += item + "\n";
    }

    const editTextDisplay = new TextDisplayBuilder().setContent(
      editHistoryText
    );
    container.addTextDisplayComponents(editTextDisplay);

    return [container];
  }

  /**
   * Creates a Components v2 message for when a thread is closed
   */
  static threadClosedMessage(
    threadLink: string,
    closeReason?: string
  ): MessageCreateOptions {
    const container = new ContainerBuilder().setAccentColor(HexColor.Gray);

    let content = "## Thread Closed";
    content += `\nNo more replies can be sent in this thread. Please create a new thread if you need to contact the user again.`;

    const titleText = new TextDisplayBuilder().setContent(content);
    container.addTextDisplayComponents(titleText);

    if (closeReason) {
      container.addSeparatorComponents(new SeparatorBuilder());

      let closeContent = `### Close Reason`;
      closeContent += `\n${quoteText(closeReason)}`;
      closeContent += `\n-# This reason is only visible to staff and was **not** sent to the user.`;

      const reasonText = new TextDisplayBuilder().setContent(closeContent);
      container.addTextDisplayComponents(reasonText);
    }

    container.addSeparatorComponents(new SeparatorBuilder());

    let linkContent = `Click to jump to the beginning of the thread:`;
    linkContent += `\n${threadLink}`;
    const linkText = new TextDisplayBuilder().setContent(linkContent);
    container.addTextDisplayComponents(linkText);

    return {
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: {
        parse: [],
      },
    };
  }

  /**
   * This creates the staff view message for the initial DM from a recipient.
   * This is NOT used when the user edits their DM.
   *
   * @param userMessage
   * @param emojis
   * @returns
   */
  static async userInitialReplyMessage(
    userMessage: UserToStaffMessage,
    emojis: StaffThreadEmojis
  ): Promise<MessageCreateOptions> {
    const files = await downloadAttachments(userMessage.attachments);

    const [primaryComponent] = this.userReplyComponents(
      userMessage,
      files,
      [],
      false,
      emojis
    );

    return {
      files: files,
      components: primaryComponent,
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: {
        parse: [],
      },
    };
  }
}
