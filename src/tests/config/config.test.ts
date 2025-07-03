import { describe, it, expect } from "bun:test";
import { getConfigFromEnv } from "../../config/config";

const originalEnv = { ...process.env };

describe("getConfigFromEnv", () => {
  it("parses valid environment variables", () => {
    process.env = {
      LOG_LEVEL: "info",
      DISCORD_TOKEN: "token",
      DISCORD_CLIENT_ID: "client",
      DATABASE_URI: "db",
      MAIL_GUILD_ID: "guild",
    };

    const config = getConfigFromEnv();

    expect(config.DISCORD_TOKEN).toBe("token");
    expect(config.LOG_LEVEL).toBe("info");
    expect(config.HEALTHCHECK_PORT).toBe(3000);
  });

  it("throws when required variables are missing", () => {
    process.env = { ...originalEnv };
    delete process.env.DISCORD_TOKEN;
    delete process.env.DISCORD_CLIENT_ID;
    delete process.env.DATABASE_URI;
    delete process.env.MAIL_GUILD_ID;

    expect(() => getConfigFromEnv()).toThrow();
  });
});

process.env = originalEnv;
