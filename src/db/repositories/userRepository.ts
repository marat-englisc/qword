import { desc, eq } from "drizzle-orm";
import { createEmptyCard, type Card, type RecordLogItem } from "ts-fsrs";
import { db } from "@/config/connection";
import { cardTable } from "../schemas/card/card";
import { cardMeaningTable } from "../schemas/card/cardMeaning";
import { deckTable } from "../schemas/card/deck";
import { userCardMeaningTable } from "../schemas/user/userCardMeaning";
import { userCardMeaningReviewTable } from "../schemas/user/userCardMeaningReview";
import { userDeckTable } from "../schemas/user/userDeck";

type UserCardMeaning = typeof userCardMeaningTable.$inferSelect;

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
  return db.transaction(async (tx) => {
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
  return db.transaction(async (tx) => {
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
) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(userCardMeaningTable)
      .where(eq(userCardMeaningTable.cardMeaningId, cardMeaningId))
      .limit(1);

    const values = getProgressValues(cardMeaningId, result.card);
    const [progress] = await tx
      .insert(userCardMeaningTable)
      .values({ id: existing?.id, ...values })
      .onConflictDoUpdate({ target: userCardMeaningTable.id, set: values })
      .returning();

    const { log } = result;
    await tx.insert(userCardMeaningReviewTable).values({
      cardMeaningId,
      userCardMeaningId: progress.id,
      rating: log.rating,
      state: log.state,
      due: log.due,
      stability: log.stability,
      difficulty: log.difficulty,
      scheduledDays: log.scheduled_days,
      elapsedDays: log.elapsed_days,
      lastElapsedDays: log.last_elapsed_days,
      learningSteps: log.learning_steps,
      review: log.review,
    });

    const [meaning] = await tx
      .select({ deckId: cardTable.deckId })
      .from(cardMeaningTable)
      .innerJoin(cardTable, eq(cardTable.id, cardMeaningTable.cardId))
      .where(eq(cardMeaningTable.id, cardMeaningId))
      .limit(1);

    await tx
      .update(userDeckTable)
      .set({ lastReviewedAt: log.review })
      .where(eq(userDeckTable.deckId, meaning.deckId));

    return progress;
  });
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

// В таблице поля camelCase, а TS-FSRS ожидает snake_case.
export function toFsrsCard(progress: UserCardMeaning): Card {
  return {
    due: progress.due,
    stability: progress.stability,
    difficulty: progress.difficulty,
    elapsed_days: progress.elapsedDays,
    scheduled_days: progress.scheduledDays,
    learning_steps: progress.learningSteps,
    reps: progress.reps,
    lapses: progress.lapses,
    state: progress.state,
    last_review: progress.lastReview ?? undefined,
  };
}

function getProgressValues(cardMeaningId: number, card: Card) {
  return {
    cardMeaningId,
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review ?? null,
  };
}
