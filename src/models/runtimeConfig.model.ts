import type { Snowflake } from "discord.js";
import type { runtimeConfig } from "../database/schema";

const DEFAULT_PREFIX = "-";

const DEFAULT_INITIAL_MESSAGE = `
Hello! 👋 Your message has been forwarded to community staff, and we'll get back to you as soon as possible!
To help us assist you faster, please include:

- What you need help with - Be as specific as possible.
- Context - If you're reporting someone, who's involved, screenshots, etc.

The more details you provide, the quicker we can resolve your request!

---

You'll get a ✅ reaction on your messages when they're successfully forwarded to staff.
`;

export class RuntimeConfig {
  public readonly guildId: string;
  public readonly openTagId: string | null;
  public readonly closedTagId: string | null;

  // User configurable settings
  protected readonly _prefix: string | null;
  public readonly forumChannelId: string | null;
  public readonly logsChannelId: string | null;
  public readonly requiredRoleIds: Snowflake[];
  protected readonly _initialMessage: string | null;
  public readonly anonymousSnippets: boolean;

  // Notifications
  public readonly notificationRoleId: string | null;
  public readonly notificationSilent: boolean;

  // Bot Status
  public readonly botStatus: string | null;

  constructor(
    guildId: string,
    openTagId: string | null,
    closedTagId: string | null,
    prefix: string | null,
    forumChannelId: string | null,
    logsChannelId: string | null,
    requiredRoleIds: Snowflake[],
    initialMessage: string | null,
    anonymousSnippets: boolean,
    notificationRoleId: string | null,
    notificationSilent: boolean,
    botStatus: string | null
  ) {
    this.guildId = guildId;

    this.openTagId = openTagId;
    this.closedTagId = closedTagId;

    this._prefix = prefix;

    // Channel IDs
    this.forumChannelId = forumChannelId;
    this.logsChannelId = logsChannelId;

    // Permissions
    this.requiredRoleIds = requiredRoleIds;

    // Threads
    this._initialMessage = initialMessage;
    this.anonymousSnippets = anonymousSnippets;

    this.notificationRoleId = notificationRoleId;
    this.notificationSilent = notificationSilent;

    this.botStatus = botStatus;
  }

  get prefix(): string {
    return this._prefix ?? DEFAULT_PREFIX;
  }

  get initialMessage(): string {
    return this._initialMessage ?? DEFAULT_INITIAL_MESSAGE;
  }

  /**
   * Create a ConfigModel from the environment ConfigType
   */
  static fromDatabaseRow(
    row: typeof runtimeConfig.$inferSelect
  ): RuntimeConfig {
    const requiredRoleIds = JSON.parse(row.requiredRoleIds);

    if (!Array.isArray(requiredRoleIds)) {
      throw new Error(
        `Invalid requiredRoleIds for guild ${row.guildId}: ${row.requiredRoleIds}`
      );
    }

    return new RuntimeConfig(
      row.guildId,
      row.openTagId,
      row.closedTagId,
      row.prefix,
      row.forumChannelId,
      row.logsChannelId,
      requiredRoleIds,
      row.initialMessage,
      row.anonymousSnippets,
      row.notificationRoleId,
      row.notificationSilent,
      row.botStatus
    );
  }

  static default(guildId: string): RuntimeConfig {
    return new RuntimeConfig(
      guildId, // Guild ID
      null, // Open tag ID
      null, // Closed tag ID
      null, // Prefix
      null, // Forum channel ID
      null, // Logs channel ID
      [], // Required role IDs
      null, // Initial message
      true, // Anonymous snippets
      null, // Notification role ID
      false, // Notification silent
      null // Bot status
    );
  }
}
