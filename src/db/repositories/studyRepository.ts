import { and, desc, eq, gte, isNull, lte, ne, or } from "drizzle-orm";
import { Rating, State } from "ts-fsrs";
import { db } from "@/config/connection";
import { cardTable } from "../schemas/card/card";
import { cardMeaningTable } from "../schemas/card/cardMeaning";
import { userCardMeaningTable } from "../schemas/user/userCardMeaning";
import { userCardMeaningReviewTable } from "../schemas/user/userCardMeaningReview";
import { userDeckTable } from "../schemas/user/userDeck";

export type StudyCard = {
  word: typeof cardTable.$inferSelect;
  meaning: typeof cardMeaningTable.$inferSelect;
  progress: typeof userCardMeaningTable.$inferSelect | null;
};

// Только начатые карточки из добавленных пользователем колод.
// Будущие сроки тоже нужны: считаем нагрузку и ближайшее повторение.
export async function getScheduledStudyCards() {
  return db
    .select({
      word: cardTable,
      meaning: cardMeaningTable,
      progress: userCardMeaningTable,
    })
    .from(userCardMeaningTable)
    .innerJoin(
      cardMeaningTable,
      eq(cardMeaningTable.id, userCardMeaningTable.cardMeaningId),
    )
    .innerJoin(cardTable, eq(cardTable.id, cardMeaningTable.cardId))
    .innerJoin(userDeckTable, eq(userDeckTable.deckId, cardTable.deckId))
    .where(ne(userCardMeaningTable.state, State.New));
}

export async function getNewStudyCards(limit: number, deckId?: number) {
  if (limit <= 0) return [];

  return db
    .select({
      word: cardTable,
      meaning: cardMeaningTable,
      progress: userCardMeaningTable,
    })
    .from(cardMeaningTable)
    .innerJoin(cardTable, eq(cardTable.id, cardMeaningTable.cardId))
    .innerJoin(userDeckTable, eq(userDeckTable.deckId, cardTable.deckId))
    .leftJoin(
      userCardMeaningTable,
      eq(userCardMeaningTable.cardMeaningId, cardMeaningTable.id),
    )
    .where(
      and(
        deckId === undefined ? undefined : eq(cardTable.deckId, deckId),
        or(
          isNull(userCardMeaningTable.id),
          eq(userCardMeaningTable.state, State.New),
        ),
      ),
    )
    .orderBy(cardMeaningTable.id)
    .limit(limit);
}

export async function getStudyCard(cardMeaningId: number) {
  const [card] = await db
    .select({
      word: cardTable,
      meaning: cardMeaningTable,
      progress: userCardMeaningTable,
    })
    .from(cardMeaningTable)
    .innerJoin(cardTable, eq(cardTable.id, cardMeaningTable.cardId))
    .innerJoin(userDeckTable, eq(userDeckTable.deckId, cardTable.deckId))
    .leftJoin(
      userCardMeaningTable,
      eq(userCardMeaningTable.cardMeaningId, cardMeaningTable.id),
    )
    .where(eq(cardMeaningTable.id, cardMeaningId))
    .limit(1);

  return card;
}

// История общая для всех колод, чтобы переключение колоды не сбрасывало лимит.
export async function getStudyReviewsToday(dayStart: Date, now: Date) {
  return db
    .select({
      cardMeaningId: userCardMeaningReviewTable.cardMeaningId,
      state: userCardMeaningReviewTable.state,
    })
    .from(userCardMeaningReviewTable)
    .where(
      and(
        gte(userCardMeaningReviewTable.review, dayStart),
        lte(userCardMeaningReviewTable.review, now),
        ne(userCardMeaningReviewTable.rating, Rating.Manual),
      ),
    )
    .orderBy(
      desc(userCardMeaningReviewTable.review),
      desc(userCardMeaningReviewTable.id),
    );
}
