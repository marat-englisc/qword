import { and, eq, gte, lte, ne, sql } from "drizzle-orm";
import type { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import { Rating, State, type RecordLogItem } from "ts-fsrs";
import { StudyCardUnavailableError } from "../../lib/studyErrors";
import { getProgressValues, validateReview } from "../reviewProgress";
import { cardTable } from "../schemas/card/card";
import { cardMeaningTable } from "../schemas/card/cardMeaning";
import { userCardMeaningTable } from "../schemas/user/userCardMeaning";
import { userCardMeaningReviewTable } from "../schemas/user/userCardMeaningReview";
import { userDeckTable } from "../schemas/user/userDeck";

export type ReviewPolicy = { dayStart: Date; maxNewCards: number };

// Called inside runDatabaseTransaction: validation, quota, progress and the log
// must share one transaction, including simultaneous answers to different cards.
export async function saveReview(
  tx: Pick<SqliteRemoteDatabase, "select" | "insert" | "update">,
  cardMeaningId: number,
  result: RecordLogItem,
  policy?: ReviewPolicy,
) {
  const [meaning] = await tx
    .select({ deckId: cardTable.deckId })
    .from(cardMeaningTable)
    .innerJoin(cardTable, eq(cardTable.id, cardMeaningTable.cardId))
    .innerJoin(userDeckTable, eq(userDeckTable.deckId, cardTable.deckId))
    .where(eq(cardMeaningTable.id, cardMeaningId))
    .limit(1);
  if (!meaning) {
    throw new StudyCardUnavailableError("Карточка не найдена в добавленных колодах.");
  }

  const [existing] = await tx
    .select()
    .from(userCardMeaningTable)
    .where(eq(userCardMeaningTable.cardMeaningId, cardMeaningId))
    .limit(1);
  validateReview(existing, result);

  const { log } = result;
  if (policy && log.state === State.New) {
    const [history] = await tx
      .select({
        count: sql<number>`COUNT(DISTINCT ${userCardMeaningReviewTable.cardMeaningId})`.mapWith(Number),
      })
      .from(userCardMeaningReviewTable)
      .where(
        and(
          gte(userCardMeaningReviewTable.review, policy.dayStart),
          lte(userCardMeaningReviewTable.review, log.review),
          eq(userCardMeaningReviewTable.state, State.New),
          ne(userCardMeaningReviewTable.rating, Rating.Manual),
        ),
      );
    if (history.count >= policy.maxNewCards) {
      throw new StudyCardUnavailableError("Дневной лимит новых карточек уже достигнут.");
    }
  }

  const values = getProgressValues(cardMeaningId, result.card);
  const [progress] = await tx
    .insert(userCardMeaningTable)
    .values(values)
    .onConflictDoUpdate({
      target: userCardMeaningTable.cardMeaningId,
      set: values,
    })
    .returning();

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

  await tx
    .update(userDeckTable)
    .set({
      lastReviewedAt: sql`MAX(COALESCE(${userDeckTable.lastReviewedAt}, ${log.review.getTime()}), ${log.review.getTime()})`,
    })
    .where(eq(userDeckTable.deckId, meaning.deckId));

  return progress;
}
