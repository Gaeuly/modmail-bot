import { SnowflakeUtil } from "discord.js";

export function randomSnowflakeID(): string {
  return SnowflakeUtil.generate().toString();
}
