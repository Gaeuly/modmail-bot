import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ContainerBuilder,
  MessageFlags,
  ModalBuilder,
  RoleSelectMenuBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  type MessageCreateOptions,
} from "discord.js";
import type { RuntimeConfig } from "models/runtimeConfig.model";
import { HexColor } from "./Color";
import type { BotEmojiName, MessageEmojiMap } from "models/botEmoji.model";

// Specific emoji set for Settings view
export const SettingsEmojiNames = [
  "logs",
  "message",
  "settings",
  "snippet",
  "message_reply",
  "prefix",
  "channel",
  "staff_user",
  "arrow_down_right",
  "user",
  "silent",
  "notify",
  "heart",
] as const satisfies readonly BotEmojiName[];

export type SettingsEmojis = MessageEmojiMap<typeof SettingsEmojiNames>;

const settingsCustomIDPrefix = "cmd.settings.";
const id = (name: string) => `${settingsCustomIDPrefix}${name}`;

const modalCustomPrefix = "modal.settings.";
const modalId = (name: string) => `${modalCustomPrefix}${name}`;

export const settingsCustomID = {
  prefix: id("prefix"),
  initialMessage: id("initialMessage"),
  forumChannelId: id("forumChannelId"),
  logsChannelId: id("logsChannelId"),
  requiredRoleIds: id("requiredRoleIds"),
  anonymousSnippets: id("anonymousSnippets"),

  notificationRoleId: id("notificationRoleId"),
  notificationSilent: id("notificationSilent"),

  // Modals
  modalPrefix: modalId("prefix"),
  modalInitialMessage: modalId("initialMessage"),
  modalBotStatus: modalId("botStatus"),
  botStatus: id("botStatus"),
};

export class SettingsCommandView {
  static buildMessage(
    config: RuntimeConfig,
    emojis: SettingsEmojis,
    disabled: boolean
  ): MessageCreateOptions {
    const container = new ContainerBuilder().setAccentColor(HexColor.Blue);

    const headerText = new TextDisplayBuilder();

    let generalSettingsContent = `## ${emojis.settings} Bot Settings`;
    generalSettingsContent += "\n### General Settings";
    generalSettingsContent += `\n${emojis.prefix} **Prefix:** \`${config.prefix}\``;
    generalSettingsContent += `\n${emojis.heart} **Bot Status:** \`${
      config.botStatus || "Not set"
    }\``;
    generalSettingsContent += `\n> This shows up as the bot's activity status.`;
    generalSettingsContent += `\n${emojis.message_reply} **Initial Message (automatic reply):**`;
    generalSettingsContent += `\n\`\`\`markdown\n${config.initialMessage}\n\`\`\``;

    headerText.setContent(generalSettingsContent);

    container.addTextDisplayComponents(headerText);

    const prefixButton = new ButtonBuilder()
      .setCustomId(settingsCustomID.prefix)
      .setLabel("Change Prefix")
      .setEmoji(emojis.prefix)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled);

    const initialMessageButton = new ButtonBuilder()
      .setCustomId(settingsCustomID.initialMessage)
      .setLabel("Change Initial Message")
      .setEmoji(emojis.message_reply)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled);

    const botStatusButton = new ButtonBuilder()
      .setCustomId(settingsCustomID.botStatus)
      .setLabel("Change Bot Status")
      .setEmoji(emojis.heart)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled);

    const generalActionRow = new ActionRowBuilder<ButtonBuilder>();
    generalActionRow.addComponents(
      prefixButton,
      initialMessageButton,
      botStatusButton
    );

    container.addActionRowComponents(generalActionRow);

    // -------------------------------------------------------------------------
    // Channel Settings

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large)
    );

    const channelSettingsText = new TextDisplayBuilder();

    let channelSettingsContent = `### Channel Settings`;

    if (config.forumChannelId === null) {
      channelSettingsContent += `\n${emojis.message} **ModMail forum channel:** \`Not set yet\``;
    } else {
      channelSettingsContent += `\n${emojis.message} **ModMail forum channel:** <#${config.forumChannelId}>`;
    }

    /*
    if (config.logsChannelId === null) {
      channelSettingsContent += `\n${emojis.logs} **Error logs channel:** \`Not set yet\``;
    } else {
      channelSettingsContent += `\n${emojis.logs} **Error logs channel:** <#${config.logsChannelId}>`;
    }
    */

    channelSettingsText.setContent(channelSettingsContent);
    container.addTextDisplayComponents(channelSettingsText);

    const forumChannelSelect = new ChannelSelectMenuBuilder()
      .setCustomId(settingsCustomID.forumChannelId)
      .setChannelTypes(ChannelType.GuildForum)
      .setDefaultChannels(config.forumChannelId ? [config.forumChannelId] : [])
      .setMinValues(1)
      .setMaxValues(1)
      .setPlaceholder("Select a ModMail channel")
      .setDisabled(disabled);

    /*
    const logsChannelSelect = new ChannelSelectMenuBuilder()
      .setCustomId(settingsCustomID.logsChannelId)
      .setDefaultChannels(config.logsChannelId ? [config.logsChannelId] : [])
      .setChannelTypes(
        ChannelType.GuildText,
        ChannelType.PublicThread,
        ChannelType.PrivateThread
      )
      .setMinValues(1)
      .setMaxValues(1)
      .setPlaceholder("Select an error logs channel")
      .setDisabled(disabled);
    */

    // Only 1 select per row
    const forumChannelRow = new ActionRowBuilder<ChannelSelectMenuBuilder>();
    forumChannelRow.addComponents(forumChannelSelect);
    container.addActionRowComponents(forumChannelRow);

    /*
    const logsChannelRow = new ActionRowBuilder<ChannelSelectMenuBuilder>();
    logsChannelRow.addComponents(logsChannelSelect);
    container.addActionRowComponents(logsChannelRow);
    */

    // -------------------------------------------------------------------------
    // Permissions & Roles

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large)
    );
    const permissionsText = new TextDisplayBuilder();
    let permissionsContent = "### Permissions";

    if (config.requiredRoleIds.length === 0) {
      permissionsContent += `\n${emojis.staff_user} **Required roles to use commands:** \`None\``;
      permissionsContent += `\n> **Note:** Without any roles set, commands will requires \`Moderate Members\` or \`Manage Server\` permissions.`;
    } else {
      permissionsContent += `\n${emojis.staff_user} **Required roles to use commands (user only needs at least 1)**`;
      permissionsContent += `\n> **Note:** Users with \`Manage Server\` permission will always be able to use commands.`;
      permissionsContent += `\n`;
      permissionsContent += config.requiredRoleIds
        .map((roleId) => `<@&${roleId}>`)
        .join(", ");
    }

    permissionsText.setContent(permissionsContent);
    container.addTextDisplayComponents(permissionsText);

    const requiredRoleSelect = new RoleSelectMenuBuilder()
      .setCustomId(settingsCustomID.requiredRoleIds)
      .setDefaultRoles(config.requiredRoleIds)
      .setMinValues(0)
      .setMaxValues(10)
      .setPlaceholder("Select roles to allow using commands")
      .setDisabled(disabled);

    const requiredRoleRow = new ActionRowBuilder<RoleSelectMenuBuilder>();
    requiredRoleRow.addComponents(requiredRoleSelect);
    container.addActionRowComponents(requiredRoleRow);

    // -------------------------------------------------------------------------
    // Snippet settings

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large)
    );
    const featureText = new TextDisplayBuilder();
    let featureContent = "### Snippets";

    if (config.anonymousSnippets) {
      featureContent += `\n${emojis.snippet} **Anonymous Snippets:** \`Enabled\``;
      featureContent += `\n> Moderator usernames will be __hidden__ in messages`;
    } else {
      featureContent += `\n${emojis.snippet} **Anonymous Snippets:** \`Disabled\``;
      featureContent += `\n> Moderator usernames will be __shown__ in messages. Regular replies without snippets can still be anonymous via anonymous reply command`;
    }
    featureText.setContent(featureContent);
    container.addTextDisplayComponents(featureText);

    const anonymousSnippetsButton = new ButtonBuilder()
      .setCustomId(settingsCustomID.anonymousSnippets)
      .setLabel("Toggle Anonymous Snippets")
      .setEmoji(emojis.snippet)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled);

    const featureActionRow = new ActionRowBuilder<ButtonBuilder>();
    featureActionRow.addComponents(anonymousSnippetsButton);
    container.addActionRowComponents(featureActionRow);

    // -------------------------------------------------------------------------
    // Notification settings

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large)
    );
    const notificationText = new TextDisplayBuilder();
    let notificationContent = "### Notifications";
    if (config.notificationRoleId === null) {
      notificationContent += `\n${emojis.user} **Notification role:** \`None\``;
      notificationContent += `\n> Add a role to mention when a new thread is created. Users with the role will also be automatically added to the thread.`;
    } else {
      notificationContent += `\n${emojis.user} **Notification role:** <@&${config.notificationRoleId}>`;
    }

    if (config.notificationSilent) {
      notificationContent += `\n${emojis.silent} **Push Notifications:** \`Silent\``;
      notificationContent += `\n> When a new thread is created, users with the notification role will get pinged but __without__ push notifications.`;
      notificationContent += `\n> Remove the notification role to disable role ping entirely.`;
    } else {
      notificationContent += `\n${emojis.notify} **Push Notifications:** \`Notify\``;
      notificationContent += `\n> When a new thread is created, users with the notification role will get push notifications.`;

      if (!config.notificationRoleId) {
        notificationContent += `\n> There's currently no notification role set, so this won't do anything.`;
      }
    }

    notificationText.setContent(notificationContent);
    container.addTextDisplayComponents(notificationText);

    // Role select menu
    const notificationRoleSelect = new RoleSelectMenuBuilder()
      .setCustomId(settingsCustomID.notificationRoleId)
      .setDefaultRoles(
        config.notificationRoleId ? [config.notificationRoleId] : []
      )
      .setMinValues(0)
      .setMaxValues(1)
      .setPlaceholder("Select a role to ping")
      .setDisabled(disabled);

    const notificationRoleRow = new ActionRowBuilder<RoleSelectMenuBuilder>();
    notificationRoleRow.addComponents(notificationRoleSelect);
    container.addActionRowComponents(notificationRoleRow);

    // Notification toggle button
    const notificationButton = new ButtonBuilder()
      .setCustomId(settingsCustomID.notificationSilent)
      .setLabel(
        config.notificationSilent
          ? "Enable Push Notifications"
          : "Silence Notifications"
      )
      .setEmoji(config.notificationSilent ? emojis.notify : emojis.silent)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled);

    const notificationActionRow = new ActionRowBuilder<ButtonBuilder>();
    notificationActionRow.addComponents(notificationButton);
    container.addActionRowComponents(notificationActionRow);

    // -------------------------------------------------------------------------

    return {
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] },
    };
  }

  static prefixModal(currentPrefix: string): ModalBuilder {
    // Use the same custom id for modal and input since there's only 1 anyways
    const modal = new ModalBuilder()
      .setCustomId(settingsCustomID.modalPrefix)
      .setTitle("Change Bot Prefix");

    const prefixInput = new TextInputBuilder()
      .setCustomId(settingsCustomID.modalPrefix)
      .setMinLength(1)
      .setMaxLength(1)
      .setLabel("New Prefix")
      .setRequired(true)
      .setValue(currentPrefix)
      .setPlaceholder("Enter a new prefix")
      .setStyle(TextInputStyle.Short);

    const row = new ActionRowBuilder<TextInputBuilder>();
    row.addComponents(prefixInput);

    modal.addComponents(row);

    return modal;
  }

  static initialMessageModal(currentInitialMessage: string): ModalBuilder {
    const modal = new ModalBuilder()
      .setCustomId(settingsCustomID.modalInitialMessage)
      .setTitle("Change Initial Message");

    const initialMessageInput = new TextInputBuilder()
      .setCustomId(settingsCustomID.modalInitialMessage)
      .setMinLength(1)
      .setMaxLength(2000)
      .setLabel("New Initial Message")
      .setRequired(true)
      .setValue(currentInitialMessage)
      .setPlaceholder("Enter a new initial message")
      .setStyle(TextInputStyle.Paragraph);

    const row = new ActionRowBuilder<TextInputBuilder>();
    row.addComponents(initialMessageInput);

    modal.addComponents(row);

    return modal;
  }

  static botStatusModal(currentBotStatus: string): ModalBuilder {
    const modal = new ModalBuilder()
      .setCustomId(settingsCustomID.modalBotStatus)
      .setTitle("Change Bot Status");

    const botStatusInput = new TextInputBuilder()
      .setCustomId(settingsCustomID.modalBotStatus)
      .setMinLength(0)
      .setMaxLength(128)
      .setLabel("Bot Status Activity")
      .setRequired(false)
      .setValue(currentBotStatus || "")
      .setPlaceholder("Bot status or leave empty to clear")
      .setStyle(TextInputStyle.Short);

    const row = new ActionRowBuilder<TextInputBuilder>();
    row.addComponents(botStatusInput);

    modal.addComponents(row);

    return modal;
  }
}
