import { Client } from "discord.js";
import { SnippetService } from "../../services/SnippetService";
import { Snippet } from "../../models/snippet.model";
import { getLogger } from "utils/logger";

import { beforeEach, describe, expect, it, mock } from "bun:test";
import { randomSnowflakeID } from "tests/utils/snowflake";
import type { BotConfig } from "models/botConfig.model";

// Mock dependencies
const mockSnippetRepository = {
  getSnippet: mock(),
  getAllSnippets: mock(),
  createSnippet: mock(),
  updateSnippet: mock(),
  deleteSnippet: mock(),
  snippetExists: mock(),
};

// Mock snippet factory
const mockSnippet = (overrides = {}): Snippet => {
  return {
    id: 1,
    guildId: randomSnowflakeID(),
    name: "test-snippet",
    content: "This is a test snippet content",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Snippet;
};

describe("SnippetService", () => {
  let client: Client;
  let snippetService: SnippetService;
  let config: BotConfig;

  beforeEach(() => {
    config = {
      guildId: randomSnowflakeID(),
    } as unknown as BotConfig;

    client = {} as unknown as Client;

    snippetService = new SnippetService(config, client, mockSnippetRepository);

    // Reset mocks
    mockSnippetRepository.getSnippet.mockReset();
    mockSnippetRepository.getAllSnippets.mockReset();
    mockSnippetRepository.createSnippet.mockReset();
    mockSnippetRepository.updateSnippet.mockReset();
    mockSnippetRepository.deleteSnippet.mockReset();
    mockSnippetRepository.snippetExists.mockReset();
  });

  describe("getSnippet", () => {
    it("should return a snippet by name", async () => {
      const guildId = randomSnowflakeID();
      const name = "test-snippet";
      const snippet = mockSnippet({ guildId, name });

      mockSnippetRepository.getSnippet.mockResolvedValue(snippet);

      const result = await snippetService.getSnippet(guildId, name);

      expect(result).toBe(snippet);
      expect(mockSnippetRepository.getSnippet).toHaveBeenCalledWith(
        guildId,
        name
      );
    });

    it("should return null if snippet is not found", async () => {
      const guildId = randomSnowflakeID();
      const name = "nonexistent-snippet";

      mockSnippetRepository.getSnippet.mockResolvedValue(null);

      const result = await snippetService.getSnippet(guildId, name);

      expect(result).toBeNull();
      expect(mockSnippetRepository.getSnippet).toHaveBeenCalledWith(
        guildId,
        name
      );
    });
  });

  describe("getAllSnippets", () => {
    it("should return all snippets for a guild", async () => {
      const guildId = randomSnowflakeID();
      const snippets = [
        mockSnippet({ guildId, name: "snippet1" }),
        mockSnippet({ guildId, name: "snippet2" }),
        mockSnippet({ guildId, name: "snippet3" }),
      ];

      mockSnippetRepository.getAllSnippets.mockResolvedValue(snippets);

      const result = await snippetService.getAllSnippets(guildId);

      expect(result).toBe(snippets);
      expect(result.length).toBe(3);
      expect(mockSnippetRepository.getAllSnippets).toHaveBeenCalledWith(
        guildId
      );
    });

    it("should return an empty array if no snippets are found", async () => {
      const guildId = randomSnowflakeID();

      mockSnippetRepository.getAllSnippets.mockResolvedValue([]);

      const result = await snippetService.getAllSnippets(guildId);

      expect(result).toEqual([]);
      expect(mockSnippetRepository.getAllSnippets).toHaveBeenCalledWith(
        guildId
      );
    });
  });

  describe("createSnippet", () => {
    it("should create a new snippet and return it", async () => {
      const guildId = randomSnowflakeID();
      const name = "new-snippet";
      const content = "This is a new snippet content";
      const newSnippet = mockSnippet({ guildId, name, content });

      // Mock the snippetExists method to return false (snippet doesn't exist yet)
      mockSnippetRepository.getSnippet.mockResolvedValue(null);
      mockSnippetRepository.createSnippet.mockResolvedValue(newSnippet);

      const result = await snippetService.createSnippet(guildId, name, content);

      expect(result).toBe(newSnippet);
      expect(mockSnippetRepository.getSnippet).toHaveBeenCalledWith(
        guildId,
        name
      );
      expect(mockSnippetRepository.createSnippet).toHaveBeenCalledWith(
        guildId,
        name,
        content
      );
    });

    it("should throw an error if snippet already exists", async () => {
      const guildId = randomSnowflakeID();
      const name = "existing-snippet";
      const content = "This is content for an existing snippet";

      // Mock the snippetExists method to return true (snippet already exists)
      mockSnippetRepository.snippetExists.mockResolvedValue(true);

      // Use await with the assertion for async rejections
      expect(
        snippetService.createSnippet(guildId, name, content)
      ).rejects.toThrow(`Snippet '${name}' already exists`);
    });
  });

  describe("updateSnippet", () => {
    it("should update an existing snippet and return it", async () => {
      const guildId = randomSnowflakeID();
      const name = "existing-snippet";
      const content = "This is the updated content";
      const updatedSnippet = mockSnippet({ guildId, name, content });

      mockSnippetRepository.updateSnippet.mockResolvedValue(updatedSnippet);

      const result = await snippetService.updateSnippet(guildId, name, content);

      expect(result).toBe(updatedSnippet);
      expect(mockSnippetRepository.updateSnippet).toHaveBeenCalledWith(
        guildId,
        name,
        content
      );
    });
  });

  describe("deleteSnippet", () => {
    it("should delete a snippet and return true on success", async () => {
      const guildId = randomSnowflakeID();
      const name = "snippet-to-delete";

      mockSnippetRepository.deleteSnippet.mockResolvedValue(true);

      const result = await snippetService.deleteSnippet(guildId, name);

      expect(result).toBe(true);
      expect(mockSnippetRepository.deleteSnippet).toHaveBeenCalledWith(
        guildId,
        name
      );
    });

    it("should return false if snippet deletion fails", async () => {
      const guildId = randomSnowflakeID();
      const name = "nonexistent-snippet";

      mockSnippetRepository.deleteSnippet.mockResolvedValue(false);

      const result = await snippetService.deleteSnippet(guildId, name);

      expect(result).toBe(false);
      expect(mockSnippetRepository.deleteSnippet).toHaveBeenCalledWith(
        guildId,
        name
      );
    });
  });

  describe("snippetNameAllowed", () => {
    it("returns false for reserved names", () => {
      expect(snippetService.snippetNameAllowed("help")).toBe(false);
      expect(snippetService.snippetNameAllowed("reply")).toBe(false);
    });

    it("returns true for non-reserved names", () => {
      expect(snippetService.snippetNameAllowed("custom")).toBe(true);
      expect(snippetService.snippetNameAllowed("another")).toBe(true);
    });
  });
});
