import { Client } from "discord.js";
import { Snippet } from "../models/snippet.model";
import { getLogger } from "utils/logger";

interface Config {
  guildId: string;
}

interface SnippetRepository {
  getSnippet(guildId: string, name: string): Promise<Snippet | null>;
  getAllSnippets(guildId: string): Promise<Snippet[]>;
  createSnippet(
    guildId: string,
    name: string,
    content: string
  ): Promise<Snippet>;
  updateSnippet(
    guildId: string,
    name: string,
    content: string
  ): Promise<Snippet>;
  deleteSnippet(guildId: string, name: string): Promise<boolean>;
}

export class SnippetService {
  private reservedNames: Set<string> = new Set(["help", "reply"]);

  private config: Config;
  private client: Client;
  private snippetRepository: SnippetRepository;
  private logger = getLogger("SnippetService");

  constructor(
    config: Config,
    client: Client,
    snippetRepository: SnippetRepository
  ) {
    this.config = config;
    this.client = client;
    this.snippetRepository = snippetRepository;
  }

  /**
   * Set the reserved snippet names that cannot be used
   * @param names Array of reserved names
   */
  setReservedNames(names: Set<string>): void {
    this.logger.debug({ names }, "Setting reserved names");

    this.reservedNames = names;
  }

  /**
   * Get a snippet by its name and guild
   * @param guildId The Discord guild ID
   * @param name The snippet name
   * @returns The snippet or null if not found
   */
  async getSnippet(guildId: string, name: string): Promise<Snippet | null> {
    this.logger.debug(`Getting snippet ${name} for guild ${guildId}`);
    return this.snippetRepository.getSnippet(guildId, name);
  }

  /**
   * Get all snippets for a guild
   * @param guildId The Discord guild ID
   * @returns Array of snippets in the guild
   */
  async getAllSnippets(guildId: string): Promise<Snippet[]> {
    this.logger.debug(`Getting all snippets for guild ${guildId}`);
    return this.snippetRepository.getAllSnippets(guildId);
  }

  /**
   * Check if a snippet exists
   * @param guildId The Discord guild ID
   * @param name The snippet name
   * @returns Whether the snippet exists
   */
  async snippetExists(guildId: string, name: string): Promise<boolean> {
    this.logger.debug(
      `Checking if snippet ${name} exists for guild ${guildId}`
    );
    const snippet = await this.snippetRepository.getSnippet(guildId, name);
    return snippet !== null;
  }

  /**
   * Check if a snippet name is allowed (not reserved)
   * @param name The snippet name to check
   * @returns Whether the name is allowed
   */
  snippetNameAllowed(name: string): boolean {
    return !this.reservedNames.has(name.toLowerCase());
  }

  /**
   * Create a new snippet
   * @param guildId The Discord guild ID
   * @param name The snippet name
   * @param content The snippet content
   * @returns The created snippet
   * @throws Error if snippet already exists or name is reserved
   */
  async createSnippet(
    guildId: string,
    name: string,
    content: string
  ): Promise<Snippet> {
    this.logger.debug(`Creating snippet ${name} for guild ${guildId}`);

    // Check if name is reserved
    if (!this.snippetNameAllowed(name)) {
      throw new Error(`Snippet name '${name}' is reserved and cannot be used`);
    }

    // Check if snippet already exists
    const exists = await this.snippetExists(guildId, name);
    if (exists) {
      throw new Error(`Snippet '${name}' already exists`);
    }

    return this.snippetRepository.createSnippet(guildId, name, content);
  }

  /**
   * Update an existing snippet
   * @param guildId The Discord guild ID
   * @param name The snippet name
   * @param content The new snippet content
   * @returns The updated snippet
   */
  async updateSnippet(
    guildId: string,
    name: string,
    content: string
  ): Promise<Snippet> {
    this.logger.debug(`Updating snippet ${name} for guild ${guildId}`);
    return this.snippetRepository.updateSnippet(guildId, name, content);
  }

  /**
   * Delete a snippet
   * @param guildId The Discord guild ID
   * @param name The snippet name
   * @returns Whether the snippet was deleted
   */
  async deleteSnippet(guildId: string, name: string): Promise<boolean> {
    this.logger.debug(`Deleting snippet ${name} for guild ${guildId}`);
    return this.snippetRepository.deleteSnippet(guildId, name);
  }
}
