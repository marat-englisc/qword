import type { SQLiteBindValue, SQLiteDatabase } from "expo-sqlite";

const contentTables = [
  ["deck", ["id", "name", "created_at", "updated_at"]],
  [
    "card",
    [
      "id",
      "deck_id",
      "title",
      "transcription",
      "audio_url",
      "created_at",
      "updated_at",
    ],
  ],
  [
    "card_meaning",
    [
      "id",
      "card_id",
      "hint",
      "meaning",
      "meaning_translation",
      "created_at",
      "updated_at",
    ],
  ],
  ["card_example", ["id", "card_meaning_id", "example", "example_translation"]],
  ["attribute", ["id", "name", "created_at", "updated_at"]],
  [
    "card_meaning_attribute",
    [
      "id",
      "card_meaning_id",
      "attribute_id",
      "value",
      "created_at",
      "updated_at",
    ],
  ],
] as const;

// Stable content IDs preserve progress. Retired words/meanings are retained;
// examples and attributes of updated meanings are replaced as one transaction.
export async function importContent(
  database: SQLiteDatabase,
  source: SQLiteDatabase,
  hash: string,
) {
  await database.withTransactionAsync(async () => {
    await database.execAsync(
      "CREATE TEMP TABLE imported_content_meanings (id INTEGER PRIMARY KEY)",
    );
    const rememberMeaning = await database.prepareAsync(
      "INSERT INTO imported_content_meanings(id) VALUES (?)",
    );
    try {
      for (const [table, columns] of contentTables) {
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
          for await (const row of source.getEachAsync<
            Record<string, SQLiteBindValue>
          >(`SELECT ${names} FROM "${table}" ORDER BY id`)) {
            await statement.executeAsync(columns.map((column) => row[column]));
            if (table === "card_meaning")
              await rememberMeaning.executeAsync(row.id);
          }
        } finally {
          await statement.finalizeAsync();
        }
        if (table === "card_meaning") {
          await database.execAsync(`
            DELETE FROM card_example
            WHERE card_meaning_id IN (SELECT id FROM imported_content_meanings);
            DELETE FROM card_meaning_attribute
            WHERE card_meaning_id IN (SELECT id FROM imported_content_meanings);
          `);
        }
      }
    } finally {
      await rememberMeaning.finalizeAsync();
    }

    await database.runAsync(
      "INSERT INTO content_import (id, hash) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET hash = excluded.hash",
      hash,
    );
    await database.execAsync("DROP TABLE imported_content_meanings");
  });
}
