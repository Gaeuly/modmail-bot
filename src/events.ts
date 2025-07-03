import { Events, type Client } from "discord.js";
import type CommandRouter from "./CommandRouter";
import parentLogger, { getLogger } from "./utils/logger";
import type { DB } from "./database/db";
import { ThreadRepository } from "repositories/thread.repository";
import { ThreadService } from "services/ThreadService";
import { MessageRelayService } from "services/MessageRelayService";
import { DMController } from "controllers/DMController";
import type { BotConfig } from "models/botConfig.model";
import { SnippetController } from "controllers/SnippetController";
import { SnippetService } from "services/SnippetService";
import { SnippetRepository } from "repositories/snippet.repository";
import { RuntimeConfigRepository } from "repositories/runtimeConfig.repository";
import { MessageRepository } from "repositories/message.repository";
import { ReactionRelayService } from "services/ReactionRelayService";
import { UserReactionController } from "controllers/UserReactionController";
import { StaffReactionController } from "controllers/StaffReactionController";
import { DiscordLogService } from "services/LogService";
import { BotEmojiRepository } from "repositories/botEmoji.repository";
import { DiscordBotEmojiService } from "services/BotEmojiService";
import { BotEmojiController } from "controllers/BotEmojiController";
import { SettingsModalController } from "controllers/SettingsModalController";
import { SettingsService } from "services/SettingsService";
import { MemberNotificationController } from "controllers/MemberNotificationController";
import { MemberNotificationService } from "services/MemberNotificationService";

/**
 * Updates bot presence based on runtime configuration
 */
async function updateBotPresence(
  client: Client,
  runtimeConfigRepository: RuntimeConfigRepository,
  guildId: string,
  logger: ReturnType<typeof getLogger>,
  context: string = ""
): Promise<void> {
  try {
    const runtimeConfig = await runtimeConfigRepository.getConfig(guildId);

    if (runtimeConfig.botStatus) {
      client.user?.setPresence({
        activities: [{ name: runtimeConfig.botStatus, type: 0 }],
        status: "online",
      });

      const logMessage = context
        ? `Bot status ${context}: ${runtimeConfig.botStatus}`
        : `Bot status set to: ${runtimeConfig.botStatus}`;
      logger.info(logMessage);
    }
  } catch (err) {
    logger.error(
      err,
      `Failed to set bot status${context ? ` ${context}` : ""}`
    );
  }
}

export function registerEventHandlers(
  config: BotConfig,
  client: Client,
  db: DB,
  commandRouter: CommandRouter
) {
  const logger = getLogger("events");

  const threadRepository = new ThreadRepository(db);
  const snippetRepository = new SnippetRepository(db);
  const runtimeConfigRepository = new RuntimeConfigRepository(db);
  const messageRepository = new MessageRepository(db);
  const botEmojiRepository = new BotEmojiRepository(db);

  const threadService = new ThreadService(
    config,
    client,
    runtimeConfigRepository,
    threadRepository,
    botEmojiRepository
  );
  const snippetService = new SnippetService(config, client, snippetRepository);
  const messageService = new MessageRelayService(
    config,
    client,
    runtimeConfigRepository,
    messageRepository,
    botEmojiRepository
  );
  const reactionService = new ReactionRelayService(
    config,
    client,
    threadRepository,
    messageRepository
  );
  const logService = new DiscordLogService(
    client,
    runtimeConfigRepository,
    config.guildId
  );
  const botEmojiService = new DiscordBotEmojiService(botEmojiRepository);
  const settingsService = new SettingsService(
    runtimeConfigRepository,
    botEmojiRepository
  );
  const notificationService = new MemberNotificationService(
    config,
    client,
    threadRepository
  );

  const dmController = new DMController(
    threadService,
    messageService,
    logService
  );
  const userReactionController = new UserReactionController(
    reactionService,
    logService
  );
  const staffReactionController = new StaffReactionController(
    reactionService,
    runtimeConfigRepository
  );
  const snippetController = new SnippetController(
    snippetService,
    threadService,
    messageService,
    runtimeConfigRepository
  );
  const botEmojiController = new BotEmojiController(
    botEmojiService,
    botEmojiRepository
  );
  const settingsModalController = new SettingsModalController(settingsService);
  const notificationController = new MemberNotificationController(
    notificationService
  );

  client.once(Events.ClientReady, async (client) => {
    logger.info(`Bot is online! ${client.user.tag}`);

    const inviteLink = `https://discord.com/oauth2/authorize?client_id=${client.user?.id}&permissions=515396455488&integration_type=0&scope=applications.commands+bot`;
    logger.info(`Invite link: ${inviteLink}`);

    // Set bot status from config
    await updateBotPresence(
      client,
      runtimeConfigRepository,
      config.guildId,
      logger,
      "on startup"
    );

    // Sync emojis on startup
    try {
      await botEmojiController.syncEmojis(client);
      await botEmojiController.verifyRegisteredEmojis();
      logger.info("Bot emojis synced.");
    } catch (err) {
      logger.error(err, "Failed to sync bot emojis on startup");
    }
  });

  client.on(Events.GuildCreate, (guild) => {
    logger.info(`Joined server: ${guild.name}`);
  });

  client.on(Events.ShardReconnecting, () => {
    logger.info("Bot is reconnecting...");
  });

  client.on(Events.ShardResume, async (replayedEvents) => {
    logger.info(
      {
        replayedEvents,
      },
      "Bot resumed"
    );

    // Set bot status from config
    await updateBotPresence(
      client,
      runtimeConfigRepository,
      config.guildId,
      logger,
      "after reconnect"
    );
  });

  client.on(Events.MessageCreate, async (message) => {
    try {
      if (message.author.bot) {
        return;
      }

      await Promise.allSettled([
        commandRouter.handleMessage(message),
        dmController.handleUserDM(message.client, message),
        snippetController.handleThreadMessage(message.client, message),
      ]);
    } catch (err) {
      logger.error(
        {
          err,
          messageId: message.id,
          userId: message.author.id,
          userName: message.author.username,
          guildId: message.guildId,
        },
        "Error handling message"
      );
    }
  });

  client.on(Events.MessageUpdate, async (_, newMessage) => {
    try {
      if (newMessage.author.bot) {
        return;
      }

      await Promise.allSettled([dmController.handleUserDMEdit(newMessage)]);
    } catch (err) {
      logger.error(
        {
          err,
          messageId: newMessage.id,
          userId: newMessage.author.id,
          userName: newMessage.author.username,
          guildId: newMessage.guildId,
        },
        "Error handling message update"
      );
    }
  });

  client.on(Events.MessageDelete, async (oldMessage) => {
    try {
      if (oldMessage?.author?.bot) {
        return;
      }

      await Promise.allSettled([dmController.handleUserDMDelete(oldMessage)]);
    } catch (err) {
      logger.error(
        {
          err,
          messageId: oldMessage.id,
          guildId: oldMessage.guildId,
        },
        "Error handling message delete"
      );
    }
  });

  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    try {
      if (user.bot) {
        return;
      }

      await Promise.allSettled([
        userReactionController.handleUserDMReactionAdd(reaction, user),
        staffReactionController.handleStaffReactionAdd(reaction, user),
      ]);
    } catch (err) {
      logger.error(
        {
          err,
          reaction: reaction.emoji.name,
          userId: user.id,
          userName: user.username,
          guildId: reaction.message.guildId,
        },
        "Error handling reaction"
      );
    }
  });

  client.on(Events.MessageReactionRemove, async (reaction, user) => {
    try {
      if (user.bot) {
        return;
      }

      await Promise.allSettled([
        userReactionController.handleUserDMReactionRemove(reaction, user),
        staffReactionController.handleStaffReactionRemove(reaction, user),
      ]);
    } catch (err) {
      logger.error(
        {
          err,
          reaction: reaction.emoji.name,
          userId: user.id,
          userName: user.username,
          guildId: reaction.message.guildId,
        },
        "Error handling reaction"
      );
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isModalSubmit()) {
        await settingsModalController.handleModal(interaction);
      }
    } catch (err) {
      logger.error(
        {
          err,
          interactionId: interaction.id,
          type: interaction.type,
          userId: interaction.user.id,
          userName: interaction.user.username,
          guildId: interaction.guildId,
        },
        "Error handling interaction"
      );
    }
  });

  // ---------------------------------------------------------------------------
  // User Notifications
  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      if (member.user.bot) {
        return;
      }

      await notificationController.handleMember(
        "join",
        member.guild,
        member.user
      );
    } catch (err) {
      logger.error(
        {
          err,
          userId: member.id,
          userName: member.user.username,
          guildId: member.guild.id,
        },
        "Error handling member join"
      );
    }
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    try {
      if (member.user.bot) {
        return;
      }

      await notificationController.handleMember(
        "leave",
        member.guild,
        member.user
      );
    } catch (err) {
      logger.error(
        {
          err,
          userId: member.id,
          userName: member.user.username,
          guildId: member.guild.id,
        },
        "Error handling member leave"
      );
    }
  });

  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    try {
      if (oldMember.user.bot) {
        return;
      }

      // Check for timeout add / remove
      const oldTimeout = oldMember.communicationDisabledUntilTimestamp;
      const newTimeout = newMember.communicationDisabledUntilTimestamp;

      if (oldTimeout === newTimeout) {
        // No change in timeout
        return;
      }

      if (newTimeout && !oldTimeout) {
        const newTimeoutDate = new Date(newTimeout);

        // If timeout date is in the past, ignore. Not cleared on timeout
        // completion.
        if (newTimeoutDate <= new Date()) {
          return;
        }

        logger.debug(
          {
            newTimeoutDate,
            userId: newMember.id,
            userName: newMember.user.username,
            guildId: newMember.guild.id,
          },
          "Member timed out"
        );

        // Timeout added
        await notificationController.handleMember(
          "timeout",
          newMember.guild,
          newMember.user,
          {
            until: newTimeoutDate,
          }
        );
        return;
      }

      if (!newTimeout && oldTimeout) {
        logger.debug(
          {
            userId: newMember.id,
            userName: newMember.user.username,
            guildId: newMember.guild.id,
          },
          "Member timeout removed"
        );

        // Timeout removed
        await notificationController.handleMember(
          "untimeout",
          newMember.guild,
          newMember.user
        );
        return;
      }
    } catch (err) {
      logger.error(
        {
          err,
          userId: newMember.id,
          userName: newMember.user.username,
          guildId: newMember.guild.id,
        },
        "Error handling member update"
      );
    }
  });

  client.on(Events.GuildBanAdd, async (ban) => {
    try {
      await notificationController.handleMember("ban", ban.guild, ban.user);
    } catch (err) {
      logger.error(
        {
          err,
          userId: ban.user.id,
          userName: ban.user.username,
          guildId: ban.guild.id,
        },
        "Error handling member ban"
      );
    }
  });

  client.on(Events.GuildBanRemove, async (ban) => {
    try {
      await notificationController.handleMember("unban", ban.guild, ban.user);
    } catch (err) {
      logger.error(
        {
          err,
          userId: ban.user.id,
          userName: ban.user.username,
          guildId: ban.guild.id,
        },
        "Error handling member unban"
      );
    }
  });
}
