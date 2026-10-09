import { eq } from "drizzle-orm";
import { db } from "@/config/connection";
import { readDeckSummaries, type DeckSummary } from "../queries/deckSummaries";
import { attributeTable } from "../schemas/card/attribute";
import { cardTable } from "../schemas/card/card";
import { cardExampleTable } from "../schemas/card/cardExample";
import { cardMeaningTable } from "../schemas/card/cardMeaning";
import { cardMeaningAttributeTable } from "../schemas/card/cardMeaningAttribute";
import { deckTable } from "../schemas/card/deck";
import { userCardMeaningTable } from "../schemas/user/userCardMeaning";
export type { DeckSummary } from "../queries/deckSummaries";

export async function getDeckSummaries(
  now = new Date(),
): Promise<DeckSummary[]> {
  return readDeckSummaries(db, now);
}

// Каждая строка содержит слово и ровно одно его значение.
export async function getDeckMeanings(deckId: number) {
  return db
    .select({
      word: cardTable,
      meaning: cardMeaningTable,
      progress: userCardMeaningTable,
    })
    .from(cardMeaningTable)
    .innerJoin(cardTable, eq(cardTable.id, cardMeaningTable.cardId))
    .leftJoin(
      userCardMeaningTable,
      eq(userCardMeaningTable.cardMeaningId, cardMeaningTable.id),
    )
    .where(eq(cardTable.deckId, deckId))
    .orderBy(cardTable.id, cardMeaningTable.id);
}

export async function getDecks() {
  return db.select().from(deckTable).orderBy(deckTable.id);
}

export async function getDeck(deckId: number) {
  const [deck] = await db
    .select()
    .from(deckTable)
    .where(eq(deckTable.id, deckId))
    .limit(1);

  return deck;
}

export async function getCards(deckId?: number) {
  return db
    .select()
    .from(cardTable)
    .where(deckId === undefined ? undefined : eq(cardTable.deckId, deckId))
    .orderBy(cardTable.id);
}

export async function getCard(cardId: number) {
  const [card] = await db
    .select()
    .from(cardTable)
    .where(eq(cardTable.id, cardId))
    .limit(1);

  return card;
}

export async function getCardMeanings(cardId: number) {
  return db
    .select()
    .from(cardMeaningTable)
    .where(eq(cardMeaningTable.cardId, cardId))
    .orderBy(cardMeaningTable.id);
}

export async function getCardMeaning(cardMeaningId: number) {
  const [meaning] = await db
    .select()
    .from(cardMeaningTable)
    .where(eq(cardMeaningTable.id, cardMeaningId))
    .limit(1);

  return meaning;
}

export async function getCardExamples(cardMeaningId: number) {
  return db
    .select()
    .from(cardExampleTable)
    .where(eq(cardExampleTable.cardMeaningId, cardMeaningId))
    .orderBy(cardExampleTable.id);
}

export async function getCardMeaningAttributes(cardMeaningId: number) {
  return db
    .select({
      id: cardMeaningAttributeTable.id,
      attributeId: attributeTable.id,
      name: attributeTable.name,
      value: cardMeaningAttributeTable.value,
    })
    .from(cardMeaningAttributeTable)
    .innerJoin(
      attributeTable,
      eq(attributeTable.id, cardMeaningAttributeTable.attributeId),
    )
    .where(eq(cardMeaningAttributeTable.cardMeaningId, cardMeaningId))
    .orderBy(cardMeaningAttributeTable.id);
}
