import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export const DB_PATH = path.resolve(process.cwd(), process.env.DATABASE_PATH ?? "./data/yado.db");

function open() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
  return db;
}

// Reuse one connection across hot reloads in development.
const g = globalThis as unknown as { __yadoDb?: ReturnType<typeof open> };
export const db = g.__yadoDb ?? (g.__yadoDb = open());
export { schema };
