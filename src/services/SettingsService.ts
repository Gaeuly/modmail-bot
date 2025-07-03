import {
  ActivityType,
  ChannelSelectMenuInteraction,
  ChannelType,
  PermissionsBitField,
  RoleSelectMenuInteraction,
  ThreadChannel,
  type AnySelectMenuInteraction,
  type AnyThreadChannel,
  type ButtonInteraction,
  type Channel,
  type GuildBasedChannel,
  type GuildChannel,
  type Interaction,
  type Message,
  type MessageCreateOptions,
  type ModalMessageModalSubmitInteraction,
  type PermissionsString,
} from "discord.js";
import { getLogger } from "utils/logger";
import {
  SettingsCommandView,
  settingsCustomID,
  SettingsEmojiNames,
  type SettingsEmojis,
} from "views/Settings";
import type { BotEmojiRepository } from "repositories/botEmoji.repository";
import type { RuntimeConfig } from "models/runtimeConfig.model";
import type { UpdateConfig } from "repositories/runtimeConfig.repository";

export interface ConfigRepository {
  getConfig(guildId: string): Promise<RuntimeConfig>;
  setConfig(guildId: string, changes: UpdateConfig): Promise<RuntimeConfig>;
  toggleAnonymousSnippets(guildId: string): Promise<RuntimeConfig>;
}

export class SettingsService {
  private configRepository: ConfigRepository;
  private emojiRepository: BotEmojiRepository;
  private logger = getLogger(this.constructor.name);

  constructor(
    configRepository: ConfigRepository,
    emojiRepository: BotEmojiRepository
  ) {
    this.configRepository = configRepository;
    this.emojiRepository = emojiRepository;
  }

  async buildSettingsMessage(
    config: RuntimeConfig,
    disabled: boolean = false
  ): Promise<MessageCreateOptions> {
    // Fetch and map emojis to strings
    const emojiMap: SettingsEmojis = await this.emojiRepository.getEmojiMap(
      SettingsEmojiNames
    );

    this.logger.debug(
      { emojis: emojiMap },
      "Fetched emojis for settings command"
    );

    // Build settings message
    return SettingsCommandView.buildMessage(config, emojiMap, disabled);
  }

  async showSettings(msg: Message<true>): Promise<void> {
    try {
      const config: RuntimeConfig = await this.configRepository.getConfig(
        msg.guildId
      );

      const settingsMsg = await this.buildSettingsMessage(config);
      const sentMsg = await msg.channel.send(settingsMsg);

      this.logger.debug(
        {
          guildId: msg.guildId,
          messageId: sentMsg.id,
        },
        "Sent settings message, listening for interactions"
      );

      // Listen for settings changes
      const collector = sentMsg.createMessageComponentCollector({
        // 2 minutes
        time: 2 * 60 * 1000,
      });

      collector.on("collect", async (interaction) => {
        this.logger.debug(
          {
            interaction: interaction.id,
            type: interaction.type,
            userId: interaction.user.id,
            userName: interaction.user.username,
            guildId: msg.guildId,
          },
          "Received interaction for settings"
        );

        if (interaction.user.id !== msg.author.id) {
          await interaction.reply({
            content: "Only the person who invoked this command can use it.",
            ephemeral: true,
          });

          return;
        }

        // Refresh config, could be a second interaction which changes the
        // config
        const config = await this.configRepository.getConfig(msg.guildId);

        await this.editSettings(interaction, config);
      });

      await new Promise<void>((resolve) =>
        collector.once("end", () => resolve())
      );

      // Disable buttons after collector ends
      const { flags, ...disabledMsg } = await this.buildSettingsMessage(
        config,
        true
      );
      await sentMsg.edit(disabledMsg);
    } catch (err: any) {
      this.logger.error(err, "Failed to execute settings service");
    }
  }

  async editSettingsMessage(
    interaction:
      | AnySelectMenuInteraction<"cached">
      | ButtonInteraction<"cached">
      | ModalMessageModalSubmitInteraction<"cached">
  ): Promise<void> {
    const config: RuntimeConfig = await this.configRepository.getConfig(
      interaction.guildId
    );

    // Exclude flags for edit
    const { flags, ...createMsg } = await this.buildSettingsMessage(config);
    await interaction.update(createMsg);
  }

  // Handler for button interactions
  private async handleButton(
    interaction: ButtonInteraction<"cached">,
    currentConfig: RuntimeConfig
  ) {
    switch (interaction.customId) {
      // Modals, no message update
      case settingsCustomID.prefix:
        return interaction.showModal(
          SettingsCommandView.prefixModal(currentConfig.prefix)
        );
      case settingsCustomID.initialMessage:
        return interaction.showModal(
          SettingsCommandView.initialMessageModal(currentConfig.initialMessage)
        );
      case settingsCustomID.botStatus:
        return interaction.showModal(
          SettingsCommandView.botStatusModal(currentConfig.botStatus || "")
        );

      // Toggles, update message
      case settingsCustomID.anonymousSnippets:
        await this.configRepository.toggleAnonymousSnippets(
          interaction.guildId
        );

        return this.editSettingsMessage(interaction);
      case settingsCustomID.notificationSilent:
        await this.configRepository.setConfig(interaction.guildId, {
          notificationSilent: !currentConfig.notificationSilent,
        });

        return this.editSettingsMessage(interaction);
      default:
        return;
    }
  }

  // Handler for channel select menu interactions
  private async handleChannelMenu(
    interaction: ChannelSelectMenuInteraction<"cached">
  ) {
    switch (interaction.customId) {
      case settingsCustomID.forumChannelId:
        if (!interaction.values.length) {
          this.logger.warn(
            "No channel selected for select menu, should not happen with minimum 1"
          );

          await interaction.reply({
            content: "No forum channel selected. Please select a channel.",
            ephemeral: true,
          });
          return;
        }

        await this.configRepository.setConfig(interaction.guildId, {
          forumChannelId: interaction.values[0],
        });

        // Update the message with new settings first, then check permissions
        // after.
        await this.editSettingsMessage(interaction);

        const forumChannel = interaction.channels.first();
        if (forumChannel && !forumChannel.isDMBased()) {
          const missing = await this.getMissingModmailChannelPermissions(
            forumChannel
          );
          await this.followUpMissingChannelPermissions(
            interaction,
            forumChannel.id,
            missing
          );
        }

        return;
      case settingsCustomID.logsChannelId:
        if (!interaction.values.length) {
          this.logger.warn(
            "No channel selected for select menu, should not happen with minimum 1"
          );

          await interaction.reply({
            content: "No logs channel selected. Please select a channel.",
            ephemeral: true,
          });
          return;
        }

        await this.configRepository.setConfig(interaction.guildId, {
          logsChannelId: interaction.values[0],
        });
        // Update the message with new settings
        await this.editSettingsMessage(interaction);

        const logChannel = interaction.channels.first();
        if (logChannel && !logChannel.isDMBased()) {
          const missing = await this.getMissingLogsChannelPermissions(
            logChannel
          );

          await this.followUpMissingChannelPermissions(
            interaction,
            logChannel.id,
            missing
          );
        }

        return;
      default:
        this.logger.warn(
          { customId: interaction.customId },
          "Unknown select menu interaction"
        );
        return;
    }
  }

  // Handler for role select menu interactions
  private async handleRoleMenu(
    interaction: RoleSelectMenuInteraction<"cached">
  ) {
    switch (interaction.customId) {
      case settingsCustomID.requiredRoleIds: {
        await this.configRepository.setConfig(interaction.guildId, {
          requiredRoleIds: interaction.values,
        });
        return this.editSettingsMessage(interaction);
      }
      case settingsCustomID.notificationRoleId: {
        if (interaction.values.length === 0) {
          await this.configRepository.setConfig(interaction.guildId, {
            notificationRoleId: null,
          });
        } else {
          // Only one role is allowed, for now...
          await this.configRepository.setConfig(interaction.guildId, {
            notificationRoleId: interaction.values[0],
          });
        }

        return this.editSettingsMessage(interaction);
      }

      default:
        this.logger.warn(
          { customId: interaction.customId },
          "Unknown select menu interaction"
        );
        return;
    }
  }

  async handleModalSubmit(
    interaction: ModalMessageModalSubmitInteraction<"cached">
  ) {
    // This comes from direct interaction event handler, not from message
    // interaction collector

    switch (interaction.customId) {
      case settingsCustomID.modalPrefix: {
        const newPrefix = interaction.fields.getTextInputValue(
          settingsCustomID.modalPrefix
        );

        this.logger.debug(
          { newPrefix },
          "Received new prefix from settings modal"
        );

        await this.configRepository.setConfig(interaction.guildId, {
          prefix: newPrefix,
        });

        break;
      }

      case settingsCustomID.modalInitialMessage: {
        const newInitialMessage = interaction.fields.getTextInputValue(
          settingsCustomID.modalInitialMessage
        );

        this.logger.debug(
          { newInitialMessage },
          "Received new initial message from settings modal"
        );

        await this.configRepository.setConfig(interaction.guildId, {
          initialMessage: newInitialMessage,
        });
        break;
      }

      case settingsCustomID.modalBotStatus: {
        const newBotStatus = interaction.fields.getTextInputValue(
          settingsCustomID.modalBotStatus
        );

        this.logger.debug(
          { newBotStatus },
          "Received new bot status from settings modal"
        );

        await this.configRepository.setConfig(interaction.guildId, {
          botStatus: newBotStatus || null,
        });

        // Update bot presence immediately
        if (newBotStatus) {
          interaction.client.user.setPresence({
            activities: [
              {
                name: newBotStatus,
                type: ActivityType.Playing,
              },
            ],
            status: "online",
          });
        } else {
          interaction.client.user.setPresence({
            activities: [],
            status: "online",
          });
        }

        break;
      }

      default: {
        // No-op, ignore unrelated interactions
        return;
      }
    }

    // Update the message with new settings
    await this.editSettingsMessage(interaction);
  }

  async editSettings(
    interaction: Interaction<"cached">,
    currentConfig: RuntimeConfig
  ): Promise<void> {
    if (interaction.isButton()) {
      return this.handleButton(interaction, currentConfig);
    }

    if (interaction.isChannelSelectMenu()) {
      return this.handleChannelMenu(interaction);
    }

    if (interaction.isRoleSelectMenu()) {
      return this.handleRoleMenu(interaction);
    }
  }

  // GuildBasedChannel is lax enough to cover ALL guild channels. Not doing any
  // channel type verification when checking permissions.
  async getMissingChannelPermissions(
    channel: GuildBasedChannel,
    requiredPermissions: Readonly<PermissionsBitField>
  ): Promise<PermissionsString[]> {
    const botMember = await channel.guild.members.fetchMe();
    const botChannelPermissions = channel.permissionsFor(botMember);

    const missingPermissions = botChannelPermissions.missing(
      requiredPermissions,
      true
    );

    this.logger.debug(
      {
        channelId: channel.id,
        botPermissions: botChannelPermissions.toArray(),
        requiredPermissions: requiredPermissions.toArray(),
        missingPermissions,
      },
      "Checking channel permissions"
    );

    return missingPermissions;
  }

  async getMissingModmailChannelPermissions(
    channel: GuildBasedChannel
  ): Promise<PermissionsString[]> {
    new PermissionsBitField();
    // Modmail channel needs:
    const requiredPermissions = new PermissionsBitField([
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.ManageChannels,
      PermissionsBitField.Flags.ReadMessageHistory,
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.ManageMessages,
      PermissionsBitField.Flags.CreatePublicThreads,
      PermissionsBitField.Flags.SendMessagesInThreads,
      PermissionsBitField.Flags.EmbedLinks,
      PermissionsBitField.Flags.AttachFiles,
      PermissionsBitField.Flags.AddReactions,
      PermissionsBitField.Flags.UseExternalEmojis,
      PermissionsBitField.Flags.ReadMessageHistory,
    ]);

    return this.getMissingChannelPermissions(channel, requiredPermissions);
  }

  async getMissingLogsChannelPermissions(
    channel: GuildBasedChannel
  ): Promise<PermissionsString[]> {
    // Logs channel needs:
    const requiredPermissions = new PermissionsBitField([
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.EmbedLinks,
      PermissionsBitField.Flags.AttachFiles,
    ]);

    if (channel.isThread()) {
      if (!channel.parent) {
        throw new Error(
          `Thread ${channel.id} has no parent channel, can't check permissions`
        );
      }

      return this.getMissingChannelPermissions(
        channel.parent,
        requiredPermissions
      );
    }

    return this.getMissingChannelPermissions(channel, requiredPermissions);
  }

  // Send follow-up when there are missing permissions
  private async followUpMissingChannelPermissions(
    interaction: ChannelSelectMenuInteraction<"cached">,
    channelId: string,
    missing: PermissionsString[]
  ): Promise<void> {
    if (missing.length === 0) {
      return;
    }

    const permissionsStr = missing.map((p) => `\`${p}\``).join(", ");

    let content = `I'm missing the following permissions in the selected channel <#${channelId}>`;
    content += `\n> ${permissionsStr}`;
    content += "\nPlease update my permissions in the channel to avoid issues.";

    await interaction.followUp({
      content: content,
      ephemeral: true,
    });
  }
}
