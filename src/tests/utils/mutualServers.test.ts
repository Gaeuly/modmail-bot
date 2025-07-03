import { describe, it, expect, mock } from "bun:test";
import { Client, DiscordAPIError, RESTJSONErrorCodes } from "discord.js";
import { getMutualServers } from "../../utils/mutualServers";

describe("getMutualServers", () => {
  it("returns guilds where user exists", async () => {
    const guild1 = {
      id: "1",
      name: "G1",
      members: { fetch: mock().mockResolvedValue({}) },
    };
    const guild2 = {
      id: "2",
      name: "G2",
      members: { fetch: mock().mockResolvedValue({}) },
    };
    const client = {
      guilds: { cache: { values: () => [guild1, guild2] } },
    } as unknown as Client;

    const result = await getMutualServers(client, "user");
    expect(result).toEqual([
      { id: "1", name: "G1" },
      { id: "2", name: "G2" },
    ]);
    expect(guild1.members.fetch).toHaveBeenCalledWith("user");
    expect(guild2.members.fetch).toHaveBeenCalledWith("user");
  });

  it("skips guilds where member not found", async () => {
    const error = new DiscordAPIError(
      { code: RESTJSONErrorCodes.UnknownMember, message: "" },
      RESTJSONErrorCodes.UnknownMember,
      404,
      "GET",
      "",
      { body: undefined, files: undefined }
    );
    const guild1 = {
      id: "1",
      name: "G1",
      members: { fetch: mock().mockRejectedValue(error) },
    };
    const guild2 = {
      id: "2",
      name: "G2",
      members: { fetch: mock().mockResolvedValue({}) },
    };
    const client = {
      guilds: { cache: { values: () => [guild1, guild2] } },
    } as unknown as Client;

    const result = await getMutualServers(client, "user");
    expect(result).toEqual([{ id: "2", name: "G2" }]);
  });

  it("throws unexpected errors", async () => {
    const err = new Error("boom");
    const guild = {
      id: "1",
      name: "G1",
      members: { fetch: mock().mockRejectedValue(err) },
    };
    const client = {
      guilds: { cache: { values: () => [guild] } },
    } as unknown as Client;
    await expect(getMutualServers(client, "user")).rejects.toThrow(err);
  });
});
