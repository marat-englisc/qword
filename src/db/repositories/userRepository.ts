import { desc, eq } from "drizzle-orm";
import { createEmptyCard, type RecordLogItem } from "ts-fsrs";
import { db, runDatabaseTransaction } from "@/config/connection";
import { getProgressValues } from "../reviewProgress";
import { saveReview, type ReviewPolicy } from "../queries/saveReview";
import { cardTable } from "../schemas/card/card";
import { cardMeaningTable } from "../schemas/card/cardMeaning";
import { deckTable } from "../schemas/card/deck";
import { userCardMeaningTable } from "../schemas/user/userCardMeaning";
import { userCardMeaningReviewTable } from "../schemas/user/userCardMeaningReview";
import { userDeckTable } from "../schemas/user/userDeck";

export async function getUserDecks() {
  return db
    .select({ userDeck: userDeckTable, deck: deckTable })
    .from(userDeckTable)
    .innerJoin(deckTable, eq(deckTable.id, userDeckTable.deckId))
    .orderBy(userDeckTable.id);
}

export async function getUserDeck(deckId: number) {
  const [userDeck] = await db
    .select()
    .from(userDeckTable)
    .where(eq(userDeckTable.deckId, deckId))
    .limit(1);

  return userDeck;
}

export async function addUserDeck(deckId: number) {
  return runDatabaseTransaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(userDeckTable)
      .where(eq(userDeckTable.deckId, deckId))
      .limit(1);

    // Повторное добавление сохраняет прежний прогресс колоды.
    if (existing) return existing;

    const [userDeck] = await tx
      .insert(userDeckTable)
      .values({ deckId })
      .returning();

    return userDeck;
  });
}

export async function getUserCardMeaning(cardMeaningId: number) {
  const [progress] = await db
    .select()
    .from(userCardMeaningTable)
    .where(eq(userCardMeaningTable.cardMeaningId, cardMeaningId))
    .limit(1);

  return progress;
}

export async function getUserCardMeanings(deckId?: number) {
  const rows = await db
    .select({ progress: userCardMeaningTable })
    .from(userCardMeaningTable)
    .innerJoin(
      cardMeaningTable,
      eq(cardMeaningTable.id, userCardMeaningTable.cardMeaningId),
    )
    .innerJoin(cardTable, eq(cardTable.id, cardMeaningTable.cardId))
    .where(deckId === undefined ? undefined : eq(cardTable.deckId, deckId))
    .orderBy(userCardMeaningTable.due, userCardMeaningTable.id);

  return rows.map((row) => row.progress);
}

export async function addUserCardMeaning(
  cardMeaningId: number,
  now = new Date(),
) {
  return runDatabaseTransaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(userCardMeaningTable)
      .where(eq(userCardMeaningTable.cardMeaningId, cardMeaningId))
      .limit(1);

    if (existing) return existing;

    const [progress] = await tx
      .insert(userCardMeaningTable)
      .values(getProgressValues(cardMeaningId, createEmptyCard(now)))
      .returning();

    return progress;
  });
}

// Передаём весь результат scheduler.next(): новое состояние и журнал ответа.
export async function saveUserCardMeaningReview(
  cardMeaningId: number,
  result: RecordLogItem,
  policy?: ReviewPolicy,
) {
  return runDatabaseTransaction((tx) =>
    saveReview(tx, cardMeaningId, result, policy),
  );
}

export async function getUserCardMeaningReviews(cardMeaningId: number) {
  return db
    .select()
    .from(userCardMeaningReviewTable)
    .where(eq(userCardMeaningReviewTable.cardMeaningId, cardMeaningId))
    .orderBy(
      desc(userCardMeaningReviewTable.review),
      desc(userCardMeaningReviewTable.id),
    );
}
