import { and, desc, eq, gt, lte, ne, sql } from "drizzle-orm";
import type { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import { Rating, State } from "ts-fsrs";
import { getStudyDayStart, type StudySettings } from "../../lib/settings";
import { calculateStreaks, localDateKey, summarizeActivity } from "../../lib/statistics";
import { cardTable } from "../schemas/card/card";
import { cardMeaningTable } from "../schemas/card/cardMeaning";
import { userCardMeaningTable as progress } from "../schemas/user/userCardMeaning";
import { userCardMeaningReviewTable as reviews } from "../schemas/user/userCardMeaningReview";
import { userDeckTable } from "../schemas/user/userDeck";

export async function readStatistics(database: Pick<SqliteRemoteDatabase, "select">, settings: StudySettings, now = new Date()) {
  // One aggregate row per active study day; never load the entire answer log.
  const day = sql<string>`strftime('%Y-%m-%d', ${reviews.review} / 1000, 'unixepoch', 'localtime', ${`-${settings.dayStartHour} hours`})`;
  const history = await database.select({
    day,
    answers: sql<number>`COUNT(*)`.mapWith(Number),
    introduced: sql<number>`COUNT(DISTINCT CASE WHEN ${reviews.state} = ${State.New} THEN ${reviews.cardMeaningId} END)`.mapWith(Number),
    reviewAttempts: sql<number>`SUM(CASE WHEN ${reviews.state} = ${State.Review} THEN 1 ELSE 0 END)`.mapWith(Number),
    recalled: sql<number>`SUM(CASE WHEN ${reviews.state} = ${State.Review} AND ${reviews.rating} > ${Rating.Again} THEN 1 ELSE 0 END)`.mapWith(Number),
    again: sql<number>`SUM(CASE WHEN ${reviews.rating} = ${Rating.Again} THEN 1 ELSE 0 END)`.mapWith(Number),
    hard: sql<number>`SUM(CASE WHEN ${reviews.rating} = ${Rating.Hard} THEN 1 ELSE 0 END)`.mapWith(Number),
    good: sql<number>`SUM(CASE WHEN ${reviews.rating} = ${Rating.Good} THEN 1 ELSE 0 END)`.mapWith(Number),
    easy: sql<number>`SUM(CASE WHEN ${reviews.rating} = ${Rating.Easy} THEN 1 ELSE 0 END)`.mapWith(Number),
  }).from(reviews).where(and(ne(reviews.rating, Rating.Manual), lte(reviews.review, now))).groupBy(day).orderBy(day);

  const [vocabulary] = await database.select({
    total: sql<number>`COUNT(*)`.mapWith(Number),
    fresh: sql<number>`SUM(CASE WHEN ${progress.id} IS NULL OR ${progress.state} = ${State.New} THEN 1 ELSE 0 END)`.mapWith(Number),
    learning: sql<number>`SUM(CASE WHEN ${progress.state} IN (${State.Learning}, ${State.Relearning}) THEN 1 ELSE 0 END)`.mapWith(Number),
    young: sql<number>`SUM(CASE WHEN ${progress.state} = ${State.Review} AND ${progress.stability} < 21 THEN 1 ELSE 0 END)`.mapWith(Number),
    mature: sql<number>`SUM(CASE WHEN ${progress.state} = ${State.Review} AND ${progress.stability} >= 21 THEN 1 ELSE 0 END)`.mapWith(Number),
  }).from(cardMeaningTable).innerJoin(cardTable, eq(cardTable.id, cardMeaningTable.cardId))
    .innerJoin(userDeckTable, eq(userDeckTable.deckId, cardTable.deckId))
    .leftJoin(progress, eq(progress.cardMeaningId, cardMeaningTable.id));

  const boundaries = Array.from({ length: 8 }, (_, index) => {
    const date = getStudyDayStart(now, settings.dayStartHour);
    date.setDate(date.getDate() + index);
    return date;
  });
  const bucket = sql<number>`CASE ${sql.join(boundaries.slice(1).map((end, index) => sql`WHEN ${progress.due} < ${end.getTime()} THEN ${index}`), sql` `)} END`;
  const forecastRows = await database.select({ bucket, count: sql<number>`COUNT(*)`.mapWith(Number) })
    .from(progress).innerJoin(cardMeaningTable, eq(cardMeaningTable.id, progress.cardMeaningId))
    .innerJoin(cardTable, eq(cardTable.id, cardMeaningTable.cardId))
    .innerJoin(userDeckTable, eq(userDeckTable.deckId, cardTable.deckId))
    .where(and(ne(progress.state, State.New), sql`${progress.due} < ${boundaries[7].getTime()}`))
    .groupBy(bucket);

  const difficult = await database.select({
    id: cardMeaningTable.id,
    word: cardTable.title,
    hint: cardMeaningTable.hint,
    translation: cardMeaningTable.meaningTranslation,
    deckId: cardTable.deckId,
    lapses: progress.lapses,
    difficulty: progress.difficulty,
  }).from(progress).innerJoin(cardMeaningTable, eq(cardMeaningTable.id, progress.cardMeaningId))
    .innerJoin(cardTable, eq(cardTable.id, cardMeaningTable.cardId))
    .innerJoin(userDeckTable, eq(userDeckTable.deckId, cardTable.deckId))
    .where(gt(progress.lapses, 0)).orderBy(desc(progress.lapses), desc(progress.difficulty), cardMeaningTable.id).limit(5);

  return {
    history,
    lifetime: summarizeActivity(history),
    streaks: calculateStreaks(history, now, settings.dayStartHour),
    vocabulary: { ...vocabulary, fresh: vocabulary.fresh || 0, learning: vocabulary.learning || 0, young: vocabulary.young || 0, mature: vocabulary.mature || 0 },
    forecast: boundaries.slice(0, 7).map((date, index) => ({ day: localDateKey(date), count: forecastRows.find((row) => row.bucket === index)?.count ?? 0 })),
    difficult,
    now: now.getTime(),
  };
}

export type StudyStatistics = Awaited<ReturnType<typeof readStatistics>>;
