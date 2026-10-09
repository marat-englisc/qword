import type { SQLiteDatabase } from "expo-sqlite";

// The shipped database contains content and the initial schema. Device updates
// must migrate the user's database without replacing it with that asset.
export async function migrateUserData(database: SQLiteDatabase) {
  await database.withTransactionAsync(async () => {
    await database.execAsync(
      "CREATE TABLE IF NOT EXISTS app_migrations (version INTEGER PRIMARY KEY)",
    );
    const applied = await database.getFirstAsync<{ version: number }>(
      "SELECT version FROM app_migrations WHERE version = 1",
    );
    if (applied) return;

    await database.execAsync(`
      CREATE TEMP TABLE progress_duplicates (
        duplicate_id INTEGER PRIMARY KEY, keep_id INTEGER NOT NULL
      );
      INSERT INTO progress_duplicates
      SELECT id AS duplicate_id, keep_id FROM (
        SELECT id, FIRST_VALUE(id) OVER (
          PARTITION BY card_meaning_id
          ORDER BY COALESCE(last_review, -1) DESC, reps DESC, id DESC
        ) AS keep_id FROM user_card_meaning
      ) WHERE id <> keep_id;

      UPDATE user_card_meaning_review
      SET user_card_meaning_id = (
        SELECT keep_id FROM progress_duplicates
        WHERE duplicate_id = user_card_meaning_id
      ) WHERE user_card_meaning_id IN (
        SELECT duplicate_id FROM progress_duplicates
      );
      DELETE FROM user_card_meaning
      WHERE id IN (SELECT duplicate_id FROM progress_duplicates);
      DROP TABLE progress_duplicates;

      UPDATE user_deck SET
        created_at = (
          SELECT MIN(other.created_at) FROM user_deck AS other
          WHERE other.deck_id = user_deck.deck_id
        ),
        last_reviewed_at = (
          SELECT MAX(other.last_reviewed_at) FROM user_deck AS other
          WHERE other.deck_id = user_deck.deck_id
        )
      WHERE id IN (SELECT MIN(id) FROM user_deck GROUP BY deck_id);
      DELETE FROM user_deck
      WHERE id NOT IN (SELECT MIN(id) FROM user_deck GROUP BY deck_id);

      CREATE UNIQUE INDEX IF NOT EXISTS user_decks_deck_unique
      ON user_deck(deck_id);
      CREATE UNIQUE INDEX IF NOT EXISTS user_card_meanings_card_meaning_unique
      ON user_card_meaning(card_meaning_id);
      CREATE INDEX IF NOT EXISTS user_card_meaning_reviews_meaning_index
      ON user_card_meaning_review(card_meaning_id, review);
      DROP INDEX IF EXISTS user_decks_deck_index;
      DROP INDEX IF EXISTS user_card_meanings_card_meaning_index;

      INSERT INTO app_migrations(version) VALUES(1);
    `);
  });
}
