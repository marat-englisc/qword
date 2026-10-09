import { drizzle, type RemoteCallback } from "drizzle-orm/sqlite-proxy";
import type { SQLiteDatabase } from "expo-sqlite";

export function createSQLiteClient(getDatabase: () => SQLiteDatabase) {
  let pending: Promise<unknown> = Promise.resolve();

  function serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = pending.then(operation, operation);
    pending = result.catch(() => undefined);
    return result;
  }

  const execute: RemoteCallback = async (sql, params, method) => {
    const database = getDatabase();
    if (method === "run") {
      await database.runAsync(sql, params);
      return { rows: [] };
    }
    const statement = await database.prepareAsync(sql);
    try {
      const result = await statement.executeForRawResultAsync(params);
      const rows = await result.getAllAsync();
      return { rows: method === "get" ? rows[0] : rows };
    } finally {
      await statement.finalizeAsync();
    }
  };

  const db = drizzle((...args) => serialize(() => execute(...args)));
  const transactionClient = drizzle(execute);
  type Transaction = Parameters<
    Parameters<typeof transactionClient.transaction>[0]
  >[0];

  // The whole transaction owns the queue, including reads. This also works on web,
  // where Expo's withExclusiveTransactionAsync is unavailable.
  db.transaction = (operation, options) =>
    serialize(() => transactionClient.transaction(operation, options));

  function runDatabaseTransaction<T>(
    operation: (transaction: Transaction) => Promise<T>,
  ): Promise<T> {
    return db.transaction(operation, { behavior: "immediate" });
  }

  return { db, runDatabaseTransaction };
}
