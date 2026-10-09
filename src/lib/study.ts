import { createEmptyCard, State, type Grade } from "ts-fsrs";
import {
  getNewStudyCards,
  getScheduledStudyCards,
  getStudyCard,
  getStudyReviewsToday,
  type StudyCard,
} from "@/db/repositories/studyRepository";
import {
  saveUserCardMeaningReview,
  toFsrsCard,
} from "@/db/repositories/userRepository";
import { scheduler } from "./scheduler";

export const studySettings = {
  newCardsPerDay: 10,
  reviewsPerNewCard: 3,
  maxDueReviewsForNew: 50,
  maxLearningCardsForNew: 20,
};

export type StudyOptions = Partial<typeof studySettings> & { deckId?: number };

export type StudyItem = StudyCard & {
  kind: "learning" | "review" | "new";
  retrievability: number | null;
};

export function getStudyDayStart(now = new Date()) {
  const start = new Date(now);
  start.setHours(4, 0, 0, 0);
  if (now < start) start.setDate(start.getDate() - 1);
  return start;
}

export async function getStudyQueue(
  options: StudyOptions = {},
  now = new Date(),
) {
  const settings = { ...studySettings, ...options };
  const dayStart = getStudyDayStart(now);
  const [scheduled, history] = await Promise.all([
    getScheduledStudyCards(),
    getStudyReviewsToday(dayStart, now),
  ]);

  const introducedToday = new Set(
    history
      .filter((review) => review.state === State.New)
      .map((review) => review.cardMeaningId),
  ).size;
  const newRemainingToday = Math.max(
    0,
    settings.newCardsPerDay - introducedToday,
  );

  let reviewsSinceNew = 0;
  for (const review of history) {
    if (review.state === State.New) break;
    if (review.state === State.Review) reviewsSinceNew++;
  }

  const learning: StudyItem[] = [];
  const reviews: StudyItem[] = [];
  let nextDue: Date | null = null;
  let dueReviewsTotal = 0;
  let learningTotal = 0;

  for (const card of scheduled) {
    const progress = card.progress;
    const isLearning =
      progress.state === State.Learning || progress.state === State.Relearning;

    if (isLearning) learningTotal++;
    if (!isLearning && progress.due <= now) dueReviewsTotal++;

    if (options.deckId !== undefined && card.word.deckId !== options.deckId)
      continue;

    if (progress.due > now) {
      if (!nextDue || progress.due < nextDue) nextDue = progress.due;
      continue;
    }

    if (isLearning) {
      learning.push({ ...card, kind: "learning", retrievability: null });
    } else {
      reviews.push({
        ...card,
        kind: "review",
        retrievability: scheduler.get_retrievability(
          toFsrsCard(progress),
          now,
          false,
        ),
      });
    }
  }

  learning.sort(
    (a, b) =>
      a.progress!.due.getTime() - b.progress!.due.getTime() ||
      a.meaning.id - b.meaning.id,
  );

  reviews.sort(
    (a, b) =>
      a.retrievability! - b.retrievability! ||
      a.progress!.due.getTime() - b.progress!.due.getTime() ||
      b.progress!.lapses - a.progress!.lapses ||
      b.progress!.difficulty - a.progress!.difficulty ||
      a.meaning.id - b.meaning.id,
  );

  const newBlocked =
    dueReviewsTotal > settings.maxDueReviewsForNew ||
    learningTotal >= settings.maxLearningCardsForNew;
  const newCards = newBlocked
    ? []
    : await getNewStudyCards(newRemainingToday, options.deckId);

  const queue: StudyItem[] = [...learning];
  let reviewIndex = 0;
  let newIndex = 0;
  while (reviewIndex < reviews.length || newIndex < newCards.length) {
    if (
      newIndex < newCards.length &&
      (reviewsSinceNew >= settings.reviewsPerNewCard ||
        reviewIndex === reviews.length)
    ) {
      queue.push({
        ...newCards[newIndex++],
        kind: "new",
        retrievability: null,
      });
      reviewsSinceNew = 0;
    } else {
      queue.push(reviews[reviewIndex++]);
      reviewsSinceNew++;
    }
  }

  const newResetAt = new Date(dayStart);
  newResetAt.setDate(newResetAt.getDate() + 1);

  return {
    queue,
    learningCount: learning.length,
    reviewCount: reviews.length,
    newCount: newCards.length,
    introducedToday,
    newRemainingToday,
    newBlocked,
    nextDue,
    newResetAt,
  };
}

export async function getNextStudyCard(
  options: StudyOptions = {},
  now = new Date(),
) {
  const result = await getStudyQueue(options, now);
  return { ...result, card: result.queue[0] ?? null };
}

export function previewStudyCard(card: StudyCard, now = new Date()) {
  const progress = card.progress
    ? toFsrsCard(card.progress)
    : createEmptyCard(now);
  return scheduler.repeat(progress, now);
}

export async function answerStudyCard(
  cardMeaningId: number,
  rating: Grade,
  now = new Date(),
) {
  const card = await getStudyCard(cardMeaningId);
  if (!card) throw new Error("Карточка не найдена в добавленных колодах.");

  const progress = card.progress
    ? toFsrsCard(card.progress)
    : createEmptyCard(now);
  if (progress.state !== State.New && progress.due > now)
    throw new Error("Срок повторения карточки ещё не наступил.");

  const result = scheduler.next(progress, now, rating);
  await saveUserCardMeaningReview(cardMeaningId, result);
  return result;
}
