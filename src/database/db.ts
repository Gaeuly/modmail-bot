import { BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import fs from "fs";
import path from "path";

export type DB = BunSQLiteDatabase;

export function getDb(dbUri: string): BunSQLiteDatabase {
  // Ensure dbUri directory path exists
  const dir = path.dirname(dbUri);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(dbUri);

  // Set busy timeout to 5 seconds, wait instead of erroring immediately (SQLiteError: database is locked)
  // Litestream requires periodic write locks during checkpointing.
  // https://litestream.io/tips/#busy-timeout
  sqlite.run("PRAGMA busy_timeout = 5000;");
  // Required by Litestream, it should already be set but just to be clear.
  sqlite.run("PRAGMA journal_mode = WAL;");

  const db = drizzle(sqlite, { casing: "snake_case" });

  migrate(db, {
    migrationsFolder: "./drizzle",
    migrationsSchema: "main",
    migrationsTable: "drizzle_migrations",
  });

  return db;
}
