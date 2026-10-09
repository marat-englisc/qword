import { eq } from "drizzle-orm";
import { State } from "ts-fsrs";
import { db } from "@/config/connection";
import { attributeTable } from "../schemas/card/attribute";
import { cardTable } from "../schemas/card/card";
import { cardExampleTable } from "../schemas/card/cardExample";
import { cardMeaningTable } from "../schemas/card/cardMeaning";
import { cardMeaningAttributeTable } from "../schemas/card/cardMeaningAttribute";
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

export async function getDeckSummaries(
  now = new Date(),
): Promise<DeckSummary[]> {
  const [decks, userDecks, rows] = await Promise.all([
    getDecks(),
    db.select().from(userDeckTable),
    db
      .select({
        deckId: cardTable.deckId,
        cardId: cardTable.id,
        meaningId: cardMeaningTable.id,
        state: userCardMeaningTable.state,
        due: userCardMeaningTable.due,
      })
      .from(cardTable)
      .leftJoin(cardMeaningTable, eq(cardMeaningTable.cardId, cardTable.id))
      .leftJoin(
        userCardMeaningTable,
        eq(userCardMeaningTable.cardMeaningId, cardMeaningTable.id),
      ),
  ]);

  return decks.map((deck) => {
    const words = rows.filter((row) => row.deckId === deck.id);
    const meanings = words.filter((row) => row.meaningId !== null);
    const studied = meanings.filter(
      (row) => row.state !== null && row.state !== State.New,
    );
    const future = studied
      .filter((row) => row.due && row.due > now)
      .map((row) => row.due!);
    return {
      id: deck.id,
      name: deck.name,
      added: userDecks.some((row) => row.deckId === deck.id),
      wordCount: new Set(words.map((row) => row.cardId)).size,
      meaningCount: meanings.length,
      studiedMeaningCount: studied.length,
      newMeaningCount: meanings.length - studied.length,
      reviewCount: studied.filter((row) => row.due && row.due <= now).length,
      nextDue: future.length
        ? new Date(Math.min(...future.map((due) => due.getTime())))
        : null,
    };
  });
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
