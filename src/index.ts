import { Client, GatewayIntentBits, Partials } from "discord.js";
import { getConfigFromEnv, type ConfigType } from "./config/config";
import logger, { initLogger } from "./utils/logger";
import CommandRouter from "./CommandRouter";
import dotenv from "dotenv";
import { registerEventHandlers } from "./events";
import { getDb, type DB } from "database/db";
import { ReplyCommand } from "commands/reply/ReplyCommand";
import { MessageRelayService } from "services/MessageRelayService";
import { ThreadService } from "services/ThreadService";
import { ThreadRepository } from "repositories/thread.repository";
import { AnonymousReplyCommand } from "commands/reply/AnonymousReplyCommand";
import { BotConfig } from "models/botConfig.model";
import { CloseCommand } from "commands/CloseCommand";
import { LogsCommand } from "commands/LogsCommand";
import { PlainReplyCommand } from "commands/reply/PlainReplyCommand";
import { AddSnippetCommand } from "commands/snippets/AddSnippetCommand";
import { GetSnippetCommand } from "commands/snippets/GetSnippetCommand";
import { SnippetService } from "services/SnippetService";
import { SnippetRepository } from "repositories/snippet.repository";
import { EditSnippetCommand } from "commands/snippets/EditSnippetCommand";
import { DeleteSnippetCommand } from "commands/snippets/DeleteSnippetCommand";
import { ListSnippetsCommand } from "commands/snippets/ListSnippetsCommand";
import { ContactCommand } from "commands/ContactCommand";
import { RuntimeConfigRepository } from "repositories/runtimeConfig.repository";
import { MessageRepository } from "repositories/message.repository";
import { EditCommand } from "commands/EditCommand";
import { DeleteCommand } from "commands/DeleteCommand";
import { SettingsCommand } from "commands/SettingsCommand";
import { BotEmojiRepository } from "repositories/botEmoji.repository";
import { SettingsService } from "services/SettingsService";
import { HelpCommand } from "commands/HelpCommand";
import { AnonymousPlainReplyCommand } from "commands/reply/AnonymousPlainReplyCommand";
import { HealthcheckService } from "services/HealthcheckService";

// Load environment variables from .env file, mostly for development
dotenv.config();

function buildCommandRouter(
  config: BotConfig,
  client: Client,
  db: DB
): CommandRouter {
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
  const messageService = new MessageRelayService(
    config,
    client,
    runtimeConfigRepository,
    messageRepository,
    botEmojiRepository
  );
  const snippetService = new SnippetService(config, client, snippetRepository);

  // Commands
  const router = new CommandRouter(runtimeConfigRepository, config);

  // Settings service
  const settingsService = new SettingsService(
    runtimeConfigRepository,
    botEmojiRepository
  );

  router.addCommands(
    // Reply commands
    new ReplyCommand(threadService, messageService, runtimeConfigRepository),
    new AnonymousReplyCommand(
      threadService,
      messageService,
      runtimeConfigRepository
    ),
    new AnonymousPlainReplyCommand(
      threadService,
      messageService,
      runtimeConfigRepository
    ),
    new PlainReplyCommand(
      threadService,
      messageService,
      runtimeConfigRepository
    ),

    // Thread message commands
    new EditCommand(threadService, messageService, runtimeConfigRepository),
    new DeleteCommand(threadService, messageService),

    // Snippets
    new GetSnippetCommand(snippetService),
    new AddSnippetCommand(snippetService),
    new EditSnippetCommand(snippetService),
    new DeleteSnippetCommand(snippetService),
    new ListSnippetsCommand(snippetService),

    // Other
    new CloseCommand(threadService, runtimeConfigRepository),
    new LogsCommand(threadService, messageService, runtimeConfigRepository),
    new ContactCommand(threadService, messageService),

    // Settings
    new SettingsCommand(settingsService),
    new HelpCommand(config)
  );

  snippetService.setReservedNames(router.getCommandNames());

  return router;
}

async function main() {
  const rawConfig = getConfigFromEnv();
  const config = BotConfig.fromConfigType(rawConfig);

  // Update log level from config
  logger.info(`Setting log level to ${config.logLevel}`);
  initLogger(config.logLevel);

  const db = getDb(config.databaseUri);

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.DirectMessageReactions,
    ],
    // Partials.Channel: Required to receive DMs with Events.MessageCreate
    // Partials.Reaction and Partials.Message: Required to receive reactions on uncached messages
    partials: [
      Partials.Channel,
      Partials.Reaction,
      Partials.Message,
      Partials.GuildMember,
      // For reactions on non-cached messages
      Partials.Reaction,
      Partials.User,
    ],
  });

  // Start healthcheck server before Discord client
  const healthcheckService = new HealthcheckService(client, config.healthcheckPort);
  healthcheckService.start();

  logger.info("Initializing command router...");
  const router = buildCommandRouter(config, client, db);

  // Event handlers
  logger.info("Registering event handlers...");
  registerEventHandlers(config, client, db, router);

  logger.info("Starting Discord client...");

  // Start client, connect to Discord gateway and listen for events
  await client.login(config.discordToken);

  // Graceful shutdown handlers
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    healthcheckService.stop();
    client.destroy();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((error) => {
  logger.error(error, "An error occurred starting the bot");
});
