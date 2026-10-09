import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { SQLiteDatabase } from "expo-sqlite";

// Runs production SQLite queries against real isolated SQLite databases, while
// keeping the native Expo module out of the Node test runtime.
export function createTestDatabase(schema = "") {
  const raw = new DatabaseSync(":memory:");
  raw.exec("PRAGMA foreign_keys = ON");
  if (schema) raw.exec(schema);

  function parameters(args: unknown[]): SQLInputValue[] {
    const values = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
    return values.map((value) =>
      typeof value === "boolean" ? Number(value) : value,
    ) as SQLInputValue[];
  }

  const database = {
    async execAsync(sql: string) {
      raw.exec(sql);
    },
    async runAsync(sql: string, ...args: unknown[]) {
      const result = raw.prepare(sql).run(...parameters(args));
      return {
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: Number(result.changes),
      };
    },
    async getFirstAsync<T>(sql: string, ...args: unknown[]) {
      return (raw.prepare(sql).get(...parameters(args)) as T | undefined) ?? null;
    },
    async getAllAsync<T>(sql: string, ...args: unknown[]) {
      return raw.prepare(sql).all(...parameters(args)) as T[];
    },
    async *getEachAsync<T>(sql: string, ...args: unknown[]) {
      for (const row of raw.prepare(sql).iterate(...parameters(args))) yield row as T;
    },
    async prepareAsync(sql: string) {
      const statement = raw.prepare(sql);
      return {
        async executeAsync(...args: unknown[]) {
          return statement.run(...parameters(args));
        },
        async executeForRawResultAsync(...args: unknown[]) {
          statement.setReturnArrays(true);
          const rows = statement.all(...parameters(args));
          return {
            async getAllAsync() {
              return rows;
            },
            async getFirstAsync() {
              return rows[0] ?? null;
            },
          };
        },
        async finalizeAsync() {},
      };
    },
    async withTransactionAsync(callback: () => Promise<void>) {
      raw.exec("BEGIN");
      try {
        await callback();
        raw.exec("COMMIT");
      } catch (error) {
        raw.exec("ROLLBACK");
        throw error;
      }
    },
  } as unknown as SQLiteDatabase;

  return { database, raw, close: () => raw.close() };
}
