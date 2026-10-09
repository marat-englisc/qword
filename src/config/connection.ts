import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { deserializeDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import { Platform } from "react-native";
import { importContent } from "@/db/importContent";
import { migrateUserData } from "@/db/migrateUserData";
import { createSQLiteClient } from "./sqliteAdapter";

let sqlite: SQLiteDatabase;

export async function initializeDatabase(database: SQLiteDatabase) {
  await database.execAsync(
    `PRAGMA foreign_keys = ON;
     PRAGMA journal_mode = WAL;
     CREATE TABLE IF NOT EXISTS content_import (id INTEGER PRIMARY KEY, hash TEXT NOT NULL);`,
  );

  const asset = Asset.fromModule(require("../../local.db"));
  const contentVersion = asset.hash ?? asset.uri;
  const saved = await database.getFirstAsync<{ hash: string }>(
    "SELECT hash FROM content_import WHERE id = 1",
  );
  if (saved?.hash !== contentVersion) {
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
      await importContent(database, source, contentVersion);
    } finally {
      await source.closeAsync();
    }
  }
  await migrateUserData(database);
  sqlite = database;
}

export const { db, runDatabaseTransaction } = createSQLiteClient(() => {
  if (!sqlite) throw new Error("Локальная база ещё не открыта.");
  return sqlite;
});
