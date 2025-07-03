import { type DB } from "../database/db";
import { runtimeConfig } from "../database/schema";
import { eq, sql } from "drizzle-orm";
import { RuntimeConfig } from "../models/runtimeConfig.model";
import { getLogger } from "utils/logger";

export type UpdateConfig = {
  requiredRoleIds?: string[];
} & Partial<Omit<typeof runtimeConfig.$inferInsert, "requiredRoleIds">>;

export class RuntimeConfigRepository {
  private db: DB;

  private logger = getLogger(this.constructor.name);

  constructor(db: DB) {
    this.db = db;
  }

  async getConfig(guildId: string): Promise<RuntimeConfig> {
    const result = await this.db
      .select()
      .from(runtimeConfig)
      .where(eq(runtimeConfig.guildId, guildId))
      .limit(1)
      .execute();

    if (result.length === 0) {
      return RuntimeConfig.default(guildId);
    }

    return RuntimeConfig.fromDatabaseRow(result[0]);
  }

  async setConfig(
    guildId: string,
    changes: UpdateConfig
  ): Promise<RuntimeConfig> {
    // Filter out any undefined values
    const toSet: Omit<typeof runtimeConfig.$inferInsert, "guildId"> =
      Object.fromEntries(
        Object.entries(changes).filter(([, v]) => v !== undefined)
      );

    if (changes.requiredRoleIds !== undefined) {
      toSet.requiredRoleIds = JSON.stringify(changes.requiredRoleIds);
    }

    this.logger.debug(
      {
        guildId,
        changes,
        toSet,
      },
      "Setting runtime config"
    );

    const inserted = await this.db
      .insert(runtimeConfig)
      .values({ guildId, ...toSet })
      .onConflictDoUpdate({
        target: [runtimeConfig.guildId],
        set: toSet,
      })
      .returning();

    return RuntimeConfig.fromDatabaseRow(inserted[0]);
  }

  async toggleAnonymousSnippets(guildId: string): Promise<RuntimeConfig> {
    const rows = await this.db
      .insert(runtimeConfig)
      .values({
        guildId,
        // Opposite of default
        anonymousSnippets: !RuntimeConfig.default(guildId).anonymousSnippets,
      })
      .onConflictDoUpdate({
        target: [runtimeConfig.guildId],
        set: {
          anonymousSnippets: sql`NOT ${runtimeConfig.anonymousSnippets}`,
        },
      })
      .returning();

    return RuntimeConfig.fromDatabaseRow(rows[0]);
  }
}
