import type { ModalSubmitInteraction } from "discord.js";
import { getLogger } from "utils/logger";
import type { SettingsService } from "services/SettingsService";

export class SettingsModalController {
  private settingsService: SettingsService;

  private logger = getLogger(this.constructor.name);

  constructor(settingsService: SettingsService) {
    this.settingsService = settingsService;
  }

  /**
   * Handle settings modal submissions.
   */
  async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) {
      return;
    }

    if (!interaction.isFromMessage()) {
      return;
    }

    this.logger.debug(
      {
        guildId: interaction.guildId,
        userId: interaction.user.id,
        customId: interaction.customId,
      },
      `Received settings modal interaction`
    );

    await this.settingsService.handleModalSubmit(interaction);
  }
}
