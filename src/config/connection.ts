import { drizzle } from "drizzle-orm/sqlite-proxy";
import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { deserializeDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import { Platform } from "react-native";
import { importContent } from "@/db/importContent";

let sqlite: SQLiteDatabase;

// SQLiteProvider вызывает это до появления экранов.
export async function initializeDatabase(database: SQLiteDatabase) {
  await database.execAsync(
    `PRAGMA foreign_keys = ON;
     PRAGMA journal_mode = WAL;
     CREATE TABLE IF NOT EXISTS content_import (id INTEGER PRIMARY KEY, hash TEXT NOT NULL);`,
  );

  const asset = Asset.fromModule(require("../../local.db"));
  const saved = await database.getFirstAsync<{ hash: string }>(
    "SELECT hash FROM content_import WHERE id = 1",
  );
  if (!asset.hash || saved?.hash !== asset.hash) {
    await asset.downloadAsync();
    let bytes: Uint8Array;
    if (Platform.OS === "web") {
      const response = await fetch(asset.uri);
      if (!response.ok) throw new Error("Не удалось загрузить local.db.");
      bytes = new Uint8Array(await response.arrayBuffer());
    } else {
      if (!asset.localUri) throw new Error("Не найден файл local.db.");
      bytes = await new File(asset.localUri).bytes();
    }

    const source = await deserializeDatabaseAsync(bytes);
    try {
      await importContent(database, source, asset.hash ?? asset.uri);
    } finally {
      await source.closeAsync();
    }
  }
  sqlite = database;
}

// Все запросы идут в локальный Expo SQLite через его асинхронный API.
export const db = drizzle(async (sql, params, method) => {
  if (!sqlite) throw new Error("Локальная база ещё не открыта.");
  if (method === "run") {
    await sqlite.runAsync(sql, params);
    return { rows: [] };
  }
  const statement = await sqlite.prepareAsync(sql);
  try {
    const result = await statement.executeForRawResultAsync(params);
    const rows = await result.getAllAsync();
    return { rows: method === "get" ? rows[0] : rows };
  } finally {
    await statement.finalizeAsync();
  }
});
