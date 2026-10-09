import { eq, sql } from "drizzle-orm";
import type { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import { State } from "ts-fsrs";
import { cardTable } from "../schemas/card/card";
import { cardMeaningTable } from "../schemas/card/cardMeaning";
import { deckTable } from "../schemas/card/deck";
import { userCardMeaningTable } from "../schemas/user/userCardMeaning";
import { userDeckTable } from "../schemas/user/userDeck";

export type DeckSummary = {
  id: number;
  name: string;
  added: boolean;
  wordCount: number;
  meaningCount: number;
  studiedMeaningCount: number;
  newMeaningCount: number;
  reviewCount: number;
  nextDue: Date | null;
};

// Aggregate in SQLite so the overview doesn't load and repeatedly scan every
// word/meaning in JavaScript. LEFT JOINs also keep empty decks visible.
export async function readDeckSummaries(
  database: Pick<SqliteRemoteDatabase, "select">,
  now = new Date(),
): Promise<DeckSummary[]> {
  const rows = await database
    .select({
      id: deckTable.id,
      name: deckTable.name,
      added: sql<boolean>`${userDeckTable.id} IS NOT NULL`.mapWith(Boolean),
      wordCount: sql<number>`COUNT(DISTINCT ${cardTable.id})`.mapWith(Number),
      meaningCount: sql<number>`COUNT(${cardMeaningTable.id})`.mapWith(Number),
      studiedMeaningCount: sql<number>`COUNT(CASE WHEN ${userCardMeaningTable.state} <> ${State.New} THEN 1 END)`.mapWith(Number),
      reviewCount: sql<number>`COUNT(CASE WHEN ${userCardMeaningTable.state} <> ${State.New} AND ${userCardMeaningTable.due} <= ${now.getTime()} THEN 1 END)`.mapWith(Number),
      nextDue: sql<number | null>`MIN(CASE WHEN ${userCardMeaningTable.state} <> ${State.New} AND ${userCardMeaningTable.due} > ${now.getTime()} THEN ${userCardMeaningTable.due} END)`,
    })
    .from(deckTable)
    .leftJoin(userDeckTable, eq(userDeckTable.deckId, deckTable.id))
    .leftJoin(cardTable, eq(cardTable.deckId, deckTable.id))
    .leftJoin(cardMeaningTable, eq(cardMeaningTable.cardId, cardTable.id))
    .leftJoin(
      userCardMeaningTable,
      eq(userCardMeaningTable.cardMeaningId, cardMeaningTable.id),
    )
    .groupBy(deckTable.id)
    .orderBy(deckTable.id);

  return rows.map((row) => ({
    ...row,
    newMeaningCount: row.meaningCount - row.studiedMeaningCount,
    nextDue: row.nextDue === null ? null : new Date(row.nextDue),
  }));
}
