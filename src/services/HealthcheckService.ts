import { Hono } from "hono";
import { serve } from "bun";
import { Status, type Client } from "discord.js";
import logger from "../utils/logger";

export enum HealthStatus {
  INITIALIZING = "initializing",
  READY = "ready",
  DISCONNECTED = "disconnected",
  ERROR = "error",
}

export class HealthcheckService {
  private app: Hono;
  private server: any;
  private client: Client;
  private port: number;

  constructor(client: Client, port: number = 3000) {
    this.client = client;
    this.port = port;
    this.app = new Hono();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.app.get("/health", (c) => {
      const status = this.getDiscordStatus();
      const isHealthy = status === HealthStatus.READY;

      return c.json(
        {
          status,
          timestamp: new Date().toISOString(),
          version: {
            gitHash: process.env.GIT_HASH || "unknown",
            buildDate: process.env.BUILD_DATE || "unknown",
          },
          discord: {
            ready: this.client.isReady(),
            uptime: this.client.uptime,
            ping: this.client.ws.ping,
          },
        },
        isHealthy ? 200 : 503
      );
    });

    this.app.get("/ready", (c) => {
      const status = this.getDiscordStatus();
      const isReady = status === HealthStatus.READY;

      return c.json(
        {
          ready: isReady,
          status,
          timestamp: new Date().toISOString(),
        },
        isReady ? 200 : 503
      );
    });
  }

  private getDiscordStatus(): HealthStatus {
    if (!this.client.isReady()) {
      // Check if we're still connecting or have failed
      switch (this.client.ws.status) {
        case Status.Ready: {
          return HealthStatus.READY;
        }
        case Status.Connecting: {
          return HealthStatus.INITIALIZING;
        }
        case Status.Disconnected: {
          return HealthStatus.DISCONNECTED;
        }
        default: {
          return HealthStatus.ERROR;
        }
      }
    }

    return HealthStatus.READY;
  }

  public start() {
    this.server = serve({
      fetch: this.app.fetch,
      port: this.port,
    });

    logger.info(`Healthcheck server started on port ${this.port}`);
  }

  public stop() {
    if (this.server) {
      this.server.stop();
      logger.info("Healthcheck server stopped");
    }
  }
}
