import {
  ChannelType,
  Client,
  Message,
  type OmitPartialGroupDMChannel,
  type PartialMessage,
} from "discord.js";
import { getLogger } from "../utils/logger";
import type { UserToStaffMessage } from "../models/relayMessage";
import type { LogService } from "../services/LogService";

export interface MessageRelayService {
  relayUserMessageToStaff(
    threadId: string,
    message: UserToStaffMessage
  ): Promise<boolean>;
  relayUserEditedMessageToStaff(
    threadId: string,
    message: UserToStaffMessage
  ): Promise<void>;
  relayUserDeletedMessageToStaff(
    threadId: string,
    messageId: string
  ): Promise<void>;
  sendInitialMessageToUser(userId: string): Promise<string>;
  sendInitialMessageToStaff(channelId: string, content: string): Promise<void>;
}

export interface Thread {
  channelId: string;
}

export interface ThreadService {
  getOrCreateThread(
    userId: string,
    username: string
  ): Promise<{ thread: Thread; isNew: boolean }>;
  getThread(userId: string): Promise<Thread | null>;
}

export class DMController {
  private threadService: ThreadService;
  private messageService: MessageRelayService;
  private logService: LogService;

  private logger = getLogger(this.constructor.name);

  constructor(
    threadService: ThreadService,
    messageService: MessageRelayService,
    logService: LogService
  ) {
    this.threadService = threadService;
    this.messageService = messageService;
    this.logService = logService;
  }

  async handleUserDM(client: Client, message: Message): Promise<void> {
    try {
      if (message.channel.type !== ChannelType.DM) {
        return;
      }

      this.logger.debug(`Handling DM from ${message.author.tag}`);

      if (message.author.bot) {
        return;
      }

      this.logger.debug(`Handling DM from ${message.author.tag}`);

      const userId = message.author.id;
      let { thread, isNew } = await this.threadService.getOrCreateThread(
        userId,
        message.author.username
      );

      let success = false;

      if (message.messageSnapshots.size > 0) {
        // Forwarded message
        const snapshot = message.messageSnapshots.first()!;

        success = await this.messageService.relayUserMessageToStaff(
          thread.channelId,
          {
            // ThreadDB stores main message ID, not forwarded message ID
            id: message.id,
            author: message.author,
            // Only use snapshot for the content itself
            content: snapshot.content,
            attachments: Array.from(snapshot.attachments.values()),
            stickers: Array.from(snapshot.stickers.values()),
            // Mark as forwarded
            forwarded: true,
            createdTimestamp: message.createdTimestamp,
          }
        );
      } else {
        // Normal message
        success = await this.messageService.relayUserMessageToStaff(
          thread.channelId,
          {
            ...message,
            attachments: Array.from(message.attachments.values()),
            stickers: Array.from(message.stickers.values()),
          }
        );
      }

      if (success) {
        // React to the user's message to indicate that it was received
        await message.react("✅");

        // If this is a new thread, send the initial message
        if (isNew) {
          const content = await this.messageService.sendInitialMessageToUser(
            userId
          );

          // Also relay the initial message to the staff -- just for transparency
          // so staff knows what the user received, otherwise sometimes forget
          // people get an initial message and less likely to adjust it if needed

          this.messageService.sendInitialMessageToStaff(
            thread.channelId,
            content
          );
        }
      }
    } catch (err) {
      const contextMsg = `Error handling DM from ${
        message.author?.tag || "unknown user"
      }`;

      // Log to both Discord and console via logService
      await this.logService.logError(err, contextMsg, this.constructor.name);

      // Send an error message to the user
      await message.author.send(
        "An error occurred while processing your message. Please try again later or notify staff in the server."
      );
    }
  }

  async handleUserDMEdit(newMessage: Message): Promise<void> {
    try {
      if (newMessage.channel.type !== ChannelType.DM) {
        return;
      }

      this.logger.debug(`Handling DM edit from ${newMessage.author.tag}`);

      if (newMessage.author.bot) {
        return;
      }

      // Don't create a new thread if it doesn't exist, e.g. if the message was
      // edited after the thread was closed.
      let thread = await this.threadService.getThread(newMessage.author.id);

      if (!thread) {
        return;
      }

      // Relay the edited message to staff
      await this.messageService.relayUserEditedMessageToStaff(
        thread.channelId,
        {
          ...newMessage,
          attachments: Array.from(newMessage.attachments.values()),
          stickers: Array.from(newMessage.stickers.values()),
        }
      );
    } catch (err) {
      const contextMsg = `Error handling DM edit from ${
        newMessage.author?.tag || "unknown user"
      }`;

      await this.logService.logError(err, contextMsg, this.constructor.name);
    }
  }

  async handleUserDMDelete(
    message: OmitPartialGroupDMChannel<Message<boolean> | PartialMessage>
  ): Promise<void> {
    try {
      if (message.channel.type !== ChannelType.DM) {
        return;
      }

      this.logger.debug(
        {
          messageId: message.id,
          channelId: message.channel,
        },
        `Handling DM delete`
      );

      if (message.author?.bot) {
        return;
      }

      // We need the author ID but gateway event only gives us the message ID
      // and channel ID. Since this is in DM, we can get the author ID from the
      // channel which is more reliable.

      // getThread does NOT create a new thread if it doesn't exist. We don't
      // want deleted messages to create new threads in case they were deleted
      // after the thread is closed.
      let thread = await this.threadService.getThread(
        message.channel.recipientId
      );

      if (!thread) {
        return;
      }

      // Relay the deleted message ID to staff
      await this.messageService.relayUserDeletedMessageToStaff(
        thread.channelId,
        message.id
      );
    } catch (err) {
      const contextMsg = `Error handling DM delete for message ${message.id}`;

      await this.logService.logError(err, contextMsg, this.constructor.name);
    }
  }
}
