import { z } from "zod";

const configSchema = z.object({
  LOG_LEVEL: z.string().optional().default("info"),

  DISCORD_TOKEN: z.string(),
  DISCORD_CLIENT_ID: z.string(),

  DATABASE_URI: z.string(),

  // Where modmails get sent to
  MAIL_GUILD_ID: z.string(),

  // Healthcheck server port
  HEALTHCHECK_PORT: z.coerce.number().optional().default(3000),

  // Build information
  GIT_HASH: z.string().optional(),
  BUILD_DATE: z.coerce.date().optional(),
});

export type ConfigType = z.infer<typeof configSchema>;

export function getConfigFromEnv(): ConfigType {
  const config = configSchema.safeParse(process.env);

  if (!config.success) {
    throw new Error(`Invalid environment variables: ${config.error}`);
  }

  return config.data;
}
