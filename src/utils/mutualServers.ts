import { Client, DiscordAPIError, RESTJSONErrorCodes } from "discord.js";

export async function getMutualServers(
  client: Client,
  userId: string
): Promise<{ id: string; name: string }[]> {
  // This is NOT efficient with many servers.
  // Bot is designed to be in only the 1-2 servers, e.g. main and appeals server
  const mutualGuilds = [];

  for (const guild of client.guilds.cache.values()) {
    // Fetch member - throws if not found
    try {
      await guild.members.fetch(userId);
    } catch (err) {
      if (
        err instanceof DiscordAPIError &&
        err.code === RESTJSONErrorCodes.UnknownMember
      ) {
        // Not found member, continue
        continue;
      }

      // Unexpected error
      throw err;
    }

    mutualGuilds.push(guild);
  }

  return mutualGuilds.map((g) => ({ id: g.id, name: g.name }));
}
