import { asc, eq, getTableColumns, notInArray, sql } from "drizzle-orm";
import { drizzle, type SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import { openDatabaseAsync } from "expo-sqlite";
import type { CardInput } from "ts-fsrs";
import { builtInDecks, CONTENT_VERSION } from "@/content/decks";
import * as schema from "./schema";

const { decks, words, attributes, examples, progress } = schema;
let db: SqliteRemoteDatabase<typeof schema>;

export type DeckSummary = Awaited<ReturnType<typeof getDecks>>[number];
export type StudyWord = Awaited<ReturnType<typeof getDeckWords>>[number];

export async function initializeDatabase() {
  const sqlite = await openDatabaseAsync("qword.db");
  // Этот адаптер выполняет SQL локально через async API Expo SQLite.
  // Сервер не используется. Async-запросы не блокируют интерфейс.
  db = drizzle(
    async (query, params, method) => {
      const statement = await sqlite.prepareAsync(query);
      try {
        if (method === "run") {
          await statement.executeAsync(params);
          return { rows: [] };
        }
        const result = await statement.executeForRawResultAsync(params);
        const rows = await result.getAllAsync();
        return { rows: method === "get" ? (rows[0] ?? []) : rows };
      } finally {
        await statement.finalizeAsync();
      }
    },
    { schema },
  );

  // Начальная схема. Если меняете столбцы, добавьте сюда миграцию через ALTER TABLE.
  await sqlite.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS decks (
      id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL,
      level TEXT NOT NULL, icon TEXT NOT NULL, color TEXT NOT NULL, position INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS words (
      id TEXT PRIMARY KEY NOT NULL, deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      title TEXT NOT NULL, ipa TEXT NOT NULL, definition_en TEXT NOT NULL,
      definition_ru TEXT NOT NULL, position INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS attributes (
      id INTEGER PRIMARY KEY AUTOINCREMENT, word_id TEXT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
      label TEXT NOT NULL, value TEXT NOT NULL, position INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS examples (
      id INTEGER PRIMARY KEY AUTOINCREMENT, word_id TEXT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
      text_en TEXT NOT NULL, text_ru TEXT NOT NULL, position INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS progress (
      word_id TEXT PRIMARY KEY NOT NULL REFERENCES words(id) ON DELETE CASCADE,
      card TEXT NOT NULL, due INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS words_deck ON words(deck_id);
    CREATE INDEX IF NOT EXISTS attributes_word ON attributes(word_id);
    CREATE INDEX IF NOT EXISTS examples_word ON examples(word_id);
    CREATE TABLE IF NOT EXISTS content_version (version INTEGER NOT NULL);
  `);

  const saved = await sqlite.getFirstAsync<{ version: number }>(
    "SELECT version FROM content_version",
  );
  if (saved?.version === CONTENT_VERSION) return;

  // Меняем только контент. Таблица progress не перезаписывается.
  await db.transaction(async (tx) => {
    await tx.delete(attributes).run();
    await tx.delete(examples).run();

    for (const [deckPosition, deck] of builtInDecks.entries()) {
      const { words: deckWords, ...deckInfo } = deck;
      const deckValues = { ...deckInfo, position: deckPosition };
      await tx
        .insert(decks)
        .values(deckValues)
        .onConflictDoUpdate({ target: decks.id, set: deckValues })
        .run();

      for (const [wordPosition, word] of deckWords.entries()) {
        const {
          attributes: wordAttributes = [],
          examples: wordExamples,
          ...wordInfo
        } = word;
        const wordValues = {
          ...wordInfo,
          deckId: deck.id,
          position: wordPosition,
        };
        await tx
          .insert(words)
          .values(wordValues)
          .onConflictDoUpdate({ target: words.id, set: wordValues })
          .run();

        if (wordAttributes.length) {
          await tx
            .insert(attributes)
            .values(
              wordAttributes.map((item, position) => ({
                ...item,
                wordId: word.id,
                position,
              })),
            )
            .run();
        }
        if (wordExamples.length) {
          await tx
            .insert(examples)
            .values(
              wordExamples.map((item, position) => ({
                ...item,
                wordId: word.id,
                position,
              })),
            )
            .run();
        }
      }
    }

    const wordIds = builtInDecks.flatMap((deck) =>
      deck.words.map((word) => word.id),
    );
    const deckIds = builtInDecks.map((deck) => deck.id);
    await tx
      .delete(words)
      .where(wordIds.length ? notInArray(words.id, wordIds) : undefined)
      .run();
    await tx
      .delete(decks)
      .where(deckIds.length ? notInArray(decks.id, deckIds) : undefined)
      .run();
    await tx.run(sql`DELETE FROM content_version`);
    await tx.run(
      sql`INSERT INTO content_version (version) VALUES (${CONTENT_VERSION})`,
    );
  });
}

export async function getDecks() {
  const now = Date.now();
  return db
    .select({
      ...getTableColumns(decks),
      total: sql<number>`count(${words.id})`,
      newCount: sql<number>`sum(case when ${words.id} is not null and ${progress.wordId} is null then 1 else 0 end)`,
      reviewCount: sql<number>`sum(case when ${progress.due} <= ${now} then 1 else 0 end)`,
      nextDue: sql<number | null>`min(${progress.due})`,
    })
    .from(decks)
    .leftJoin(words, eq(words.deckId, decks.id))
    .leftJoin(progress, eq(progress.wordId, words.id))
    .groupBy(decks.id)
    .orderBy(asc(decks.position))
    .all();
}

export async function getDeckWords(deckId?: string) {
  const rows = await db
    .select({ word: words, progress })
    .from(words)
    .leftJoin(progress, eq(progress.wordId, words.id))
    .where(deckId ? eq(words.deckId, deckId) : undefined)
    .orderBy(asc(words.position))
    .all();

  const wordAttributes = await db
    .select({ ...getTableColumns(attributes) })
    .from(attributes)
    .innerJoin(words, eq(attributes.wordId, words.id))
    .where(deckId ? eq(words.deckId, deckId) : undefined)
    .orderBy(asc(attributes.position))
    .all();
  const wordExamples = await db
    .select({ ...getTableColumns(examples) })
    .from(examples)
    .innerJoin(words, eq(examples.wordId, words.id))
    .where(deckId ? eq(words.deckId, deckId) : undefined)
    .orderBy(asc(examples.position))
    .all();

  return rows.map(({ word, progress: saved }) => ({
    ...word,
    card: saved?.card ?? null,
    due: saved?.due ?? 0,
    attributes: wordAttributes.filter((item) => item.wordId === word.id),
    examples: wordExamples.filter((item) => item.wordId === word.id),
  }));
}

export async function saveProgress(wordId: string, card: CardInput) {
  const values = { wordId, card, due: new Date(card.due).getTime() };
  await db
    .insert(progress)
    .values(values)
    .onConflictDoUpdate({ target: progress.wordId, set: values })
    .run();
}
