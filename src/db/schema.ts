import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { CardInput } from "ts-fsrs";

export const decks = sqliteTable("decks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  level: text("level").notNull(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  position: integer("position").notNull(),
});

export const words = sqliteTable("words", {
  id: text("id").primaryKey(),
  deckId: text("deck_id")
    .notNull()
    .references(() => decks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  ipa: text("ipa").notNull(),
  definitionEn: text("definition_en").notNull(),
  definitionRu: text("definition_ru").notNull(),
  position: integer("position").notNull(),
});

export const attributes = sqliteTable("attributes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  wordId: text("word_id")
    .notNull()
    .references(() => words.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  value: text("value").notNull(),
  position: integer("position").notNull(),
});

export const examples = sqliteTable("examples", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  wordId: text("word_id")
    .notNull()
    .references(() => words.id, { onDelete: "cascade" }),
  textEn: text("text_en").notNull(),
  textRu: text("text_ru").notNull(),
  position: integer("position").notNull(),
});

// FSRS-карточка хранится целиком. После чтения даты — строки; TS-FSRS принимает их.
export const progress = sqliteTable("progress", {
  wordId: text("word_id")
    .primaryKey()
    .references(() => words.id, { onDelete: "cascade" }),
  card: text("card", { mode: "json" }).$type<CardInput>().notNull(),
  due: integer("due").notNull(),
});
