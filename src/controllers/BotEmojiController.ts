import { promises as fs } from "fs";
import { createHash } from "crypto";
import path from "path";
import type { ApplicationEmoji, Client } from "discord.js";
import {
  BotEmojiNameSchema,
  type BotEmojiName,
} from "../models/botEmoji.model";
import type { BotEmojiRepository } from "../repositories/botEmoji.repository";
import { DiscordBotEmojiService } from "../services/BotEmojiService";
import { getLogger } from "utils/logger";

export class BotEmojiController {
  private emojiService: DiscordBotEmojiService;
  private emojiRepository: BotEmojiRepository;
  private emojiDir: string;

  private logger = getLogger(this.constructor.name);

  constructor(
    emojiService: DiscordBotEmojiService,
    emojiRepository: BotEmojiRepository
  ) {
    this.emojiService = emojiService;
    this.emojiRepository = emojiRepository;
    this.emojiDir = path.resolve("./emojis/composites");
  }

  /**
   * Syncs emojis on startup: uploads new or changed emojis.
   */
  async syncEmojis(client: Client<true>): Promise<void> {
    const files = await fs.readdir(this.emojiDir);

    this.logger.info(
      {
        emojis: files.length,
      },
      `Found ${files.length} emojis to sync`
    );

    const applicationEmojis = await client.application.emojis.fetch();
    const applicationNameToEmoji = new Map<string, ApplicationEmoji>();
    for (const emoji of applicationEmojis.values()) {
      if (!emoji.name) {
        continue;
      }

      applicationNameToEmoji.set(emoji.name, emoji);
    }

    for (const file of files) {
      if (!file.endsWith(".png")) {
        this.logger.warn(
          {
            file,
          },
          `Skipping non-PNG file`
        );

        continue;
      }

      // File name must be alphanumeric or underscores only
      if (!/^[a-zA-Z0-9_]+\.png$/.test(file)) {
        this.logger.warn(
          {
            file,
          },
          `Invalid emoji file name, skipping...`
        );

        continue;
      }

      // Check the file is under 256 KB
      const stats = await fs.stat(path.join(this.emojiDir, file));
      if (stats.size > 256 * 1024) {
        this.logger.warn(
          {
            file,
            size: stats.size,
          },
          `Emoji is larger than 256 KB, skipping....`
        );

        continue;
      }

      const name = path.basename(file, ".png");

      const validatedName = BotEmojiNameSchema.safeParse(name);

      if (!validatedName.success) {
        throw new Error(
          `Invalid emoji name: '${name}', not included in emoji name list: ${validatedName.error}`
        );
      }

      const filePath = path.join(this.emojiDir, file);
      const buffer = await fs.readFile(filePath);

      const sha256 = createHash("sha256").update(buffer).digest("hex");

      const dbEmoji = await this.emojiRepository.getEmoji(validatedName.data);

      const discordEmoji = applicationNameToEmoji.get(name);
      const dbHash = dbEmoji?.sha256;

      if (discordEmoji && !dbEmoji) {
        // Case 1: exists in Discord && not in DB
        // Just save it to DB, ignoring hash check
        this.logger.info(
          { emojiName: name, sha256 },
          `Emoji already exists with the same name but not registered, saving... If the emoji is not correct, delete it and restart`
        );

        await this.emojiRepository.saveEmoji(
          validatedName.data,
          discordEmoji.id,
          sha256
        );
      } else if (!discordEmoji && dbEmoji) {
        // Case 2: not in Discord && exists in DB
        // Upload it to Discord and save ID
        this.logger.info(
          { emojiName: name, sha256 },
          `Emoji registered in database but not in Discord, uploading`
        );

        await this.emojiService.uploadEmoji(
          client,
          validatedName.data,
          sha256,
          buffer
        );
      } else if (discordEmoji && dbEmoji && dbHash === sha256) {
        // Case 3: exists in both && hash matches
        // No action needed
        this.logger.trace({ emojiName: name }, `Emoji up to date, skipping`);
      } else if (discordEmoji && dbEmoji && dbHash !== sha256) {
        // Case 4: exists in both && hash differs
        // Replace emoji in Discord and save ID
        this.logger.info(
          {
            emojiName: name,
            existingSha256: dbHash,
            newSha256: sha256,
          },
          `Emoji has changed, replacing...`
        );

        await this.emojiService.editEmoji(
          client,
          validatedName.data,
          sha256,
          buffer,
          dbEmoji.id
        );
      } else {
        // Case 5: not in both discord nor DB
        // Upload it to Discord and save ID
        this.logger.info(
          { emojiName: name, sha256 },
          `New emoji, uploading and registering`
        );

        await this.emojiService.uploadEmoji(
          client,
          validatedName.data,
          sha256,
          buffer
        );
      }
    }
  }

  async verifyRegisteredEmojis(): Promise<void> {
    // Check all emojis in enum exist in db. Enum just does type checking, but
    // we want to check they are actually stored in the database.
    const expectedEmojis = BotEmojiNameSchema.options;

    const registeredEmojis = await this.emojiRepository.getEmojis(
      BotEmojiNameSchema.options
    );

    // Check if all expected emojis are registered
    const missingEmojis = expectedEmojis.filter(
      (emoji) => !registeredEmojis.some((e) => e.name === emoji)
    );

    if (missingEmojis.length > 0) {
      this.logger.error(
        {
          missingEmojis,
        },
        "Emojis used but not registered in database, ensure emoji files exists"
      );
    } else {
      this.logger.info("All emojis are registered");
    }
  }
}
