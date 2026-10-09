import type { SQLiteBindValue, SQLiteDatabase } from "expo-sqlite";

// Обновляем только контент. Пользовательские таблицы остаются на месте.
export async function importContent(
  database: SQLiteDatabase,
  source: SQLiteDatabase,
  hash: string,
) {
  await database.withTransactionAsync(async () => {
    for (const table of [
      "deck",
      "card",
      "card_meaning",
      "card_example",
      "attribute",
      "card_meaning_attribute",
    ]) {
      const rows = await source.getAllAsync<Record<string, SQLiteBindValue>>(
        `SELECT * FROM "${table}"`,
      );
      if (!rows.length) continue;

      const columns = Object.keys(rows[0]);
      const names = columns.map((column) => `"${column}"`).join(", ");
      const placeholders = columns.map(() => "?").join(", ");
      const updates = columns
        .filter((column) => column !== "id")
        .map((column) => `"${column}" = excluded."${column}"`)
        .join(", ");
      const statement = await database.prepareAsync(
        `INSERT INTO "${table}" (${names}) VALUES (${placeholders})
         ON CONFLICT(id) DO UPDATE SET ${updates}`,
      );
      try {
        for (const row of rows) {
          await statement.executeAsync(columns.map((column) => row[column]));
        }
      } finally {
        await statement.finalizeAsync();
      }
    }

    await database.runAsync(
      "INSERT INTO content_import (id, hash) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET hash = excluded.hash",
      hash,
    );
  });
}
