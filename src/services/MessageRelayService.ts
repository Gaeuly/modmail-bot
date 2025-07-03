import {
  AttachmentBuilder,
  Client,
  Collection,
  Colors,
  ComponentType,
  ContainerComponent,
  DiscordAPIError,
  MessageFlags,
  RESTJSONErrorCodes,
  type Snowflake,
} from "discord.js";
import type { Message, MessageSticker } from "models/message.model";
import type { NewMessage } from "repositories/message.repository";
import { getLogger } from "utils/logger";
import { Color } from "views/Color";
import { StaffThreadEmojis, StaffThreadView } from "views/StaffThreadView";
import type {
  UserToStaffMessage,
  StaffToUserMessage,
  RelayAttachment,
} from "../models/relayMessage";
import {
  UserThreadView,
  type UserThreadViewGuild,
  type UserThreadViewUser,
} from "views/UserThreadView";
import {
  downloadAttachments,
  extractComponentImages,
  extractImageURLsFromComponents,
} from "views/util";
import type { RuntimeConfig } from "models/runtimeConfig.model";
import type { BotEmojiRepository } from "repositories/botEmoji.repository";
import type { MessageVersion } from "models/messageVersion.model";

interface Config {
  guildId: string;
}

export interface StaffMessageOptions {
  anonymous: boolean;
  plainText: boolean;
  snippet: boolean;
  snippetName?: string;
}

export const defaultStaffMessageOptions: StaffMessageOptions = {
  anonymous: false,
  plainText: false,
  snippet: false,
  snippetName: undefined,
};

export interface Attachment {
  id: Snowflake;
  name: string;
  size: number;
  url: string;
}

export interface MessageRelayServiceMessage {
  author: {
    tag: string;
  };
  content: string;
  attachments: Collection<Snowflake, Attachment>;
}

type EditStaffMessageResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
    };

type DeleteStaffMessageResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
    };

interface ConfigRepository {
  getConfig(guildId: string): Promise<RuntimeConfig>;
}

interface MessageRepository {
  saveMessage(msg: NewMessage): Promise<Message>;
  deleteMessage(messageId: string): Promise<void>;
  getByThreadMessageId(messageId: string): Promise<Message | null>;
  getByUserDMMessageId(dmMessageId: string): Promise<Message | null>;
  saveNewMessageVersion(messageId: string, newContent: string): Promise<void>;
  getMessageVersions(messageId: string): Promise<MessageVersion[]>;
  getAdditionalMessageIds(messageId: string): Promise<string[]>;
  saveAdditionalMessageId(
    mainMessageId: string,
    additionalMessageId: string
  ): Promise<void>;
}

export class MessageRelayService {
  private config: Config;
  private client: Client;

  private configRepository: ConfigRepository;
  private messageRepository: MessageRepository;
  private emojiRepository: BotEmojiRepository;

  private logger = getLogger("MessageRelayService");

  constructor(
    config: Config,
    client: Client,
    configRepository: ConfigRepository,
    messageRepository: MessageRepository,
    emojiRepository: BotEmojiRepository
  ) {
    this.config = config;
    this.client = client;

    this.configRepository = configRepository;
    this.messageRepository = messageRepository;
    this.emojiRepository = emojiRepository;
  }

  // ---------------------------------------------------------------------------
  // User -> Staff

  async relayUserMessageToStaff(
    threadId: string,
    message: UserToStaffMessage
  ): Promise<boolean> {
    const threadChannel = await this.client.channels.fetch(threadId);
    if (!threadChannel) {
      throw new Error(`Channel not found: ${threadId}`);
    }

    if (!threadChannel.isSendable()) {
      throw new Error(`Cannot send to channel: ${threadId}`);
    }

    this.logger.debug(
      {
        user: message.author.username,
        content: message.content,
        attachments: message.attachments.length,
        stickers: message.stickers.length,
      },
      "Relaying user message to staff"
    );

    const emojis = await this.emojiRepository.getEmojiMap(StaffThreadEmojis);

    const msg = await StaffThreadView.userInitialReplyMessage(message, emojis);
    const relayedMsg = await threadChannel.send(msg);

    // Save message to database
    await this.messageRepository.saveMessage({
      threadId: threadId,
      // Message in forum thread
      messageId: relayedMsg.id,
      isStaff: false,
      // Original User's DM message
      authorId: message.author.id,
      userDmMessageId: message.id,
      content: message.content,
      // Staff columns
      // Not a staff message, so no relayed message
      staffRelayedMessageId: null,
      isAnonymous: null,
      isPlainText: null,
      isSnippet: null,
      attachmentUrls: Array.from(
        message.attachments.values().map((a) => a.url)
      ),
      stickers: Array.from(
        message.stickers.values().map((s) => ({
          name: s.name,
          url: s.url,
        }))
      ),
    });

    // TODO: Blocked return false OR if more than 2 options, return an emoji
    return true;
  }

  async relayUserEditedMessageToStaff(
    threadId: string,
    message: UserToStaffMessage
  ): Promise<void> {
    const threadChannel = await this.client.channels.fetch(threadId);
    if (!threadChannel) {
      throw new Error(`Channel not found: ${threadId}`);
    }

    if (!threadChannel.isSendable()) {
      throw new Error(`Cannot send to channel: ${threadId}`);
    }

    this.logger.debug(
      {
        user: message.author.username,
        content: message.content,
      },
      "Relaying user edited message to staff"
    );

    // Gets the thread message from user original DM message ID
    const threadMessage = await this.messageRepository.getByUserDMMessageId(
      message.id
    );

    if (!threadMessage) {
      this.logger.error(
        {
          threadId: threadId,
          messageId: message.id,
        },
        "Could not find relay message for user edited message"
      );

      return;
    }

    // Update the existing message in the thread (showing previous versions too)
    const emojis = await this.emojiRepository.getEmojiMap(StaffThreadEmojis);

    // Save the new message version
    await this.messageRepository.saveNewMessageVersion(
      threadMessage.messageId,
      message.content
    );

    const messageVersions = await this.messageRepository.getMessageVersions(
      threadMessage.messageId
    );

    this.logger.debug(
      {
        messageId: threadMessage.messageId,
        newContent: message.content,
        messageVersions,
      },
      "Relaying user edited message to staff"
    );

    const updatedComponents = StaffThreadView.userReplyComponents(
      message,
      [], // Ignore attachments, they're preserved already
      messageVersions,
      true,
      emojis
    );

    await threadChannel.messages.edit(threadMessage.messageId, {
      components: updatedComponents[0],
      // Preserve allowed mentions to none
      allowedMentions: { parse: [] },
      flags: MessageFlags.IsComponentsV2,
    });

    if (updatedComponents.length === 1) {
      // Nothing more to do, no edit history components.
      // 2 components means it created a dedicated message for user edit history.
      return;
    }

    // If there are more than 1 components, that means it created a dedicated
    // message for user edit history. First fetch to see if we already have one
    const additionalMessageIDs =
      await this.messageRepository.getAdditionalMessageIds(
        threadMessage.messageId
      );

    if (additionalMessageIDs.length > 0) {
      // Edit existing
      const additionalMessage = await threadChannel.messages.fetch(
        additionalMessageIDs[0]
      );

      if (!additionalMessage) {
        this.logger.error(
          {
            threadId: threadId,
            messageId: additionalMessageIDs[0],
          },
          "Could not find additional message for user edited message"
        );
        return;
      }

      this.logger.debug(
        {
          additionalMessageId: additionalMessage.id,
          content: message.content,
        },
        "Editing existing user edit history message"
      );
      await additionalMessage.edit({
        // There will only be 1 component for edit history for now.
        components: updatedComponents[1],
        flags: MessageFlags.IsComponentsV2,
        // Preserve allowed mentions to none
        allowedMentions: { parse: [] },
      });

      return;
    } else {
      // Create a new message for user edit history
      this.logger.debug(
        {
          threadId: threadId,
          messageId: threadMessage.messageId,
          content: message.content,
        },
        "Creating new user edit history message"
      );

      const additionalMessage = await threadChannel.send({
        components: updatedComponents[1],
        flags: MessageFlags.IsComponentsV2,
        // Preserve allowed mentions to none
        allowedMentions: { parse: [] },
        reply: {
          // Reply to the original message in the thread
          messageReference: threadMessage.messageId,
        },
      });

      // Save the additional message ID
      await this.messageRepository.saveAdditionalMessageId(
        threadMessage.messageId,
        additionalMessage.id
      );
      this.logger.debug(
        {
          additionalMessageId: additionalMessage.id,
          threadId: threadId,
          messageId: threadMessage.messageId,
        },
        "Saved additional message ID for user edit history"
      );
    }
  }

  async relayUserDeletedMessageToStaff(
    threadId: string,
    messageId: string
  ): Promise<void> {
    const threadChannel = await this.client.channels.fetch(threadId);
    if (!threadChannel) {
      throw new Error(`Channel not found: ${threadId}`);
    }

    if (!threadChannel.isSendable()) {
      throw new Error(`Cannot send to channel: ${threadId}`);
    }

    this.logger.debug(
      {
        messageId,
      },
      "Relaying user deleted message to staff"
    );

    const threadMessage = await this.messageRepository.getByUserDMMessageId(
      messageId
    );

    const msg = StaffThreadView.userReplyDeletedMessage(
      messageId,
      threadMessage?.messageId
    );

    await threadChannel.send(msg);
  }

  // ---------------------------------------------------------------------------
  // Staff -> User

  /**
   * Relay a message from staff to a user via DM
   * @param client The Discord client
   * @param userId The Discord user ID to send the message to
   * @param staffUser The staff member who sent the message
   * @param content The message content
   * @param options Message options
   * @returns The ID of the relayed message
   */
  async relayStaffMessageToUser(
    threadId: string,
    userId: string,
    guild: UserThreadViewGuild,
    msg: StaffToUserMessage,
    options: StaffMessageOptions = defaultStaffMessageOptions
  ): Promise<void> {
    // Fetch the user to DM
    const user = await this.client.users.fetch(userId);

    // Attachments are re-uploaded to the staff thread.
    // DM message attachments use the URLs from the original message
    this.logger.debug(
      {
        recipient: user.username,
        content: msg.content,
        attachments: msg.attachments.length,
      },
      "Relaying staff message to user"
    );

    // -------------------------------------------------------------------------
    // STAFF THREAD
    // Download the attachments and re-upload them to the staff thread
    const files = await downloadAttachments(msg.attachments);

    const emojis = await this.emojiRepository.getEmojiMap(StaffThreadEmojis);

    // Re-send to show the message was sent and how it looks
    const components = StaffThreadView.staffReplyComponents(
      {
        ...msg,
        attachments: files.map((file) => ({
          // Need to use the file name from the downloadedAttachments, as the
          // name is modified to be unique.
          name: file.name!,
          // Does not use URL, only name for reference
          url: "DUMMY",
        })),
      },
      emojis,
      options
    );

    const staffThread = await this.client.channels.fetch(threadId);
    if (!staffThread) {
      throw new Error(`Thread channel not found: ${threadId}`);
    }

    if (!staffThread.isSendable()) {
      throw new Error(`Cannot send to channel: ${threadId}`);
    }

    // Need to send the message with attachments first to the staff thread.
    // We use the attachments in this message to send to the user.
    const threadStaffMsg = await staffThread.send({
      components,
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] },
      // New staff messages with attachments, need to be uploaded.
      files,
    });

    // Extract the attachment URLs from the message
    const { attachmentUrls: attachmentURLs, stickers } =
      extractComponentImages(threadStaffMsg);

    this.logger.debug(
      { attachmentURLs, stickers },
      "Extracted attachment URLs and stickers from staff message"
    );

    // -------------------------------------------------
    // USER DM
    // Format the message for user facing DM

    // Create a new message object with extracted attachment URLs
    const msgWithExtractedAttachments: StaffToUserMessage = {
      ...msg,
      attachments: attachmentURLs.map((url, index) => ({
        id: `extracted-${index}`,
        name: msg.attachments[index]?.name || `attachment-${index}`,
        url,
      })),
      stickers,
    };

    // Use the extracted attachment URLs and stickers to build the message
    const message = await UserThreadView.staffMessage(
      guild,
      msgWithExtractedAttachments,
      options
    );

    let relayedMsg;
    try {
      relayedMsg = await user.send(message);
    } catch (error) {
      if (
        error instanceof DiscordAPIError &&
        error.code === RESTJSONErrorCodes.CannotSendMessagesToThisUser
      ) {
        // User has blocked the bot or has privacy settings that prevent DMs
        this.logger.debug(
          {
            userId: user.id,
            threadId: threadId,
            error: error.message,
          },
          "User has blocked the bot or has privacy settings that prevent DMs"
        );

        // Edit the staff thread message to indicate the user cannot be DMed
        const failedComponents = StaffThreadView.staffReplyComponents(
          msg,
          emojis,
          options,
          { failed: true }
        );

        try {
          await threadStaffMsg.edit({
            components: failedComponents,
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] },
          });
        } catch (err) {
          this.logger.error(
            {
              threadId: threadId,
              messageId: threadStaffMsg.id,
              error: (err as Error).message,
            },
            "Failed to edit staff thread message after user DM failure"
          );

          // Continue to send the error message
        }

        // Send error message to staff thread
        const errorMessage = StaffThreadView.userDMsDisabledError();
        await staffThread.send({
          ...errorMessage,
          reply: {
            messageReference: threadStaffMsg.id,
          },
        });

        // Don't save the message to the database
        return;
      }

      // Re-throw other errors
      throw error;
    }

    // ------------------------------------------------
    // Persist message
    await this.saveStaffMessage({
      threadId: threadId,
      threadMessageId: threadStaffMsg.id,
      relayedMessageId: relayedMsg.id,
      authorId: msg.author.id,
      content: msg.content,
      isAnonymous: options.anonymous,
      isPlainText: options.plainText,
      isSnippet: options.snippet,
      attachmentUrls: attachmentURLs,
      stickers: stickers,
    });
  }

  async saveStaffMessage(options: {
    threadId: string;
    threadMessageId: string;
    relayedMessageId: string | null;
    authorId: string;
    content: string;
    isAnonymous: boolean;
    isPlainText: boolean;
    isSnippet: boolean;
    attachmentUrls: string[];
    stickers: MessageSticker[];
  }): Promise<void> {
    await this.messageRepository.saveMessage({
      threadId: options.threadId,
      messageId: options.threadMessageId,
      isStaff: true,
      authorId: options.authorId,
      staffRelayedMessageId: options.relayedMessageId,
      // Not user
      userDmMessageId: null,
      content: options.content,
      isAnonymous: options.isAnonymous,
      isPlainText: options.isPlainText,
      isSnippet: options.isSnippet,
      attachmentUrls: options.attachmentUrls,
      stickers: options.stickers,
    });
  }

  /**
   * Relay an edited message from staff to a user
   * @param staffViewMessageId The ID of the staff message
   * @param userId The Discord user ID to send the message to
   * @param guild The guild
   * @param staffUser The staff member who edited the message
   * @param content The new message content
   * @param options Message options
   */
  async editStaffMessage(
    staffViewMessageId: string,
    userId: string,
    guild: UserThreadViewGuild,
    msg: StaffToUserMessage
  ): Promise<EditStaffMessageResult> {
    // Fetch the user to DM
    const user = await this.client.users.fetch(userId);

    // Fetch the original message from the database
    const messageData = await this.messageRepository.getByThreadMessageId(
      staffViewMessageId
    );
    if (!messageData) {
      throw new Error(`Message not found: ${staffViewMessageId}`);
    }

    if (messageData.isUser()) {
      this.logger.debug(
        {
          messageId: messageData.messageId,
        },
        "Cannot edit relayed staff message: is a user message"
      );

      return {
        ok: false,
        message:
          "You can only edit staff messages. Make sure to reply to the staff message you want to edit.",
      };
    }

    const threadChannel = await this.client.channels.fetch(
      messageData.threadId
    );

    if (!threadChannel) {
      throw new Error(`Thread channel not found: ${messageData.threadId}`);
    }

    if (!threadChannel.isThread()) {
      throw new Error(`Not thread: ${messageData.threadId}`);
    }

    const originalMessage = await threadChannel.messages.fetch(
      staffViewMessageId
    );

    const { attachmentUrls, stickers } =
      extractComponentImages(originalMessage);

    this.logger.debug(
      {
        attachmentUrls,
        stickers,
        originalStaffMessage: originalMessage,
        messageData,
      },
      "Editing relayed staff message"
    );

    // ----
    // STAFF MODMAIL THREAd
    // Send a staff view of the edited message
    const staffFullUser = await this.client.users.fetch(messageData.authorId);
    const emojis = await this.emojiRepository.getEmojiMap(StaffThreadEmojis);

    const components = StaffThreadView.staffReplyComponents(
      {
        author: staffFullUser,
        // message
        id: messageData.messageId,
        content: msg.content,
        attachments: attachmentUrls,
        stickers: stickers,
        forwarded: msg.forwarded,
        createdTimestamp: msg.createdTimestamp,
      },
      emojis,
      {
        anonymous: messageData.isAnonymous,
        plainText: messageData.isPlainText,
        snippet: messageData.isSnippet,
      },
      {
        editedById: msg.author.id,
      }
    );

    // Edit the staff message
    await threadChannel.messages.edit(messageData.messageId, {
      components,
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] },
    });

    // -------------------------------------------------------------------------
    // USER DM
    // Re-build staff message with new content
    // Exclude flags since they are incompatible with editing
    const { flags, ...newMessage } = await UserThreadView.staffMessage(
      guild,
      {
        ...msg,
        // Update the attachments and stickers from msg URLs
        attachments: attachmentUrls,
        stickers: stickers,
      },
      {
        anonymous: messageData.isAnonymous,
        plainText: messageData.isPlainText,
        snippet: messageData.isSnippet,
      }
    );

    // Edit user dm message
    const dmChannel = await user.createDM();
    await dmChannel.messages.edit(
      messageData.staffRelayedMessageId,
      newMessage
    );

    return {
      ok: true,
    };
  }

  /**
   * Delete a relayed message from staff
   * @param recipientUserId The Discord user ID to delete a message from
   * @param messageId The ID of the deleted message
   */
  async deleteStaffMessage(
    recipientUserId: string,
    staffViewMessageId: string,
    deletedById: string
  ): Promise<DeleteStaffMessageResult> {
    // -------------------------------------------------------------------------
    // DATA REQUIREMENTS

    // Fetch the user to DM
    const user = await this.client.users.fetch(recipientUserId);

    // Fetch the original message from the database
    const messageData = await this.messageRepository.getByThreadMessageId(
      staffViewMessageId
    );
    if (!messageData) {
      throw new Error(`Message not found: ${staffViewMessageId}`);
    }

    if (messageData.isUser()) {
      this.logger.debug(
        messageData,
        "Cannot delete relayed staff message: is a user message"
      );

      return {
        ok: false,
        message:
          "You can only delete staff messages. Make sure to reply to the staff message you want to delete.",
      };
    }

    if (messageData.isDeleted) {
      return {
        ok: false,
        message: "Message is already deleted",
      };
    }

    this.logger.debug(messageData, "Deleting relayed staff message");

    // -------------------------------------------------------------------------
    // USER DM

    // Delete the message
    const dmChannel = await user.createDM();
    await dmChannel.messages.delete(messageData.staffRelayedMessageId);

    // -------------------------------------------------------------------------
    // MODMAIL STAFF THREAD

    // Update the staff message in thread
    const threadChannel = await this.client.channels.fetch(
      messageData.threadId
    );

    if (!threadChannel) {
      throw new Error(`Thread channel not found: ${messageData.threadId}`);
    }

    if (!threadChannel.isThread()) {
      throw new Error(`Not thread: ${messageData.threadId}`);
    }

    const originalMessage = await threadChannel.messages.fetch(
      messageData.messageId
    );
    if (!originalMessage) {
      throw new Error(`Message not found: ${messageData.messageId}`);
    }

    const { attachmentUrls: attachmentURLs, stickers } =
      extractComponentImages(originalMessage);

    // Re-build staff message
    const staffUser = await this.client.users.fetch(messageData.authorId);
    const emojis = await this.emojiRepository.getEmojiMap(StaffThreadEmojis);
    const components = StaffThreadView.staffReplyComponents(
      {
        author: staffUser,
        id: messageData.messageId,
        content: messageData.content,
        attachments: attachmentURLs,
        stickers: stickers,
        forwarded: messageData.forwarded,
        createdTimestamp: originalMessage.createdTimestamp,
      },
      emojis,
      {
        anonymous: messageData.isAnonymous,
        plainText: messageData.isPlainText,
        snippet: messageData.isSnippet,
      },
      {
        deletedById: deletedById,
      }
    );

    // Edit the message
    await threadChannel.messages.edit(messageData.messageId, {
      components,
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] },
    });

    await this.messageRepository.deleteMessage(messageData.messageId);

    return {
      ok: true,
    };
  }

  /**
   * Sends the initial welcome message to a user when they create a new thread
   * @param userId The Discord user ID to send the welcome message to
   * @param channelId The thread channel ID
   * @returns The initial message content
   */
  async sendInitialMessageToUser(userId: string): Promise<string> {
    // Fetch the user
    const user = await this.client.users.fetch(userId);

    // Fetch the modmail guild
    const guild = this.client.guilds.cache.get(this.config.guildId);
    if (!guild) {
      throw new Error(`Guild not found: ${this.config.guildId}`);
    }

    const guildConfig = await this.configRepository.getConfig(guild.id);

    // Generate initial message
    const initialMessage = UserThreadView.initialMessage(
      guild,
      guildConfig.initialMessage
    );

    // Send to user
    await user.send(initialMessage);

    return guildConfig.initialMessage;
  }

  async sendInitialMessageToStaff(
    channelId: string,
    content: string
  ): Promise<void> {
    const threadChannel = await this.client.channels.fetch(channelId);
    if (!threadChannel) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    if (!threadChannel.isSendable()) {
      throw new Error(`Cannot send to channel: ${channelId}`);
    }

    const msg = StaffThreadView.systemMessage(content);

    await threadChannel.send(msg);
  }
}
