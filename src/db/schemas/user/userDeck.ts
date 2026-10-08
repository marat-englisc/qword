import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { deckTable } from "../card/deck";

export const userDeckTable = sqliteTable(
  "user_deck",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),

    deckId: integer("deck_id")
      .notNull()
      .references(() => deckTable.id, {
        onDelete: "cascade",
      }),

    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),

    lastReviewedAt: integer("last_reviewed_at", { mode: "timestamp_ms" }),
  },
  (table) => [index("user_decks_deck_idx").on(table.deckId)],
);
