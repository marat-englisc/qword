import { State } from "ts-fsrs";
import type { StudyCard } from "@/db/repositories/studyRepository";
import { scheduler, toFsrsCard } from "./scheduler";

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

type StudyReview = { cardMeaningId: number; state: State };

export function getStudyDayStart(now = new Date()) {
  const start = new Date(now);
  start.setHours(4, 0, 0, 0);
  if (now < start) start.setDate(start.getDate() - 1);
  return start;
}

export function planStudyQueue(
  scheduled: StudyCard[],
  history: StudyReview[],
  options: StudyOptions = {},
  now = new Date(),
) {
  const settings = { ...studySettings, ...options };
  for (const name of Object.keys(studySettings) as (keyof typeof studySettings)[]) {
    if (!Number.isSafeInteger(settings[name]) || settings[name] < 0)
      throw new Error(`Некорректная настройка практики: ${name}.`);
  }
  if (
    options.deckId !== undefined &&
    (!Number.isSafeInteger(options.deckId) || options.deckId <= 0)
  )
    throw new Error("Некорректный идентификатор колоды.");
  if (!Number.isFinite(now.getTime())) throw new Error("Некорректная дата практики.");

  const introducedToday = new Set(
    history
      .filter((review) => review.state === State.New)
      .map((review) => review.cardMeaningId),
  ).size;
  const newRemainingToday = Math.max(0, settings.newCardsPerDay - introducedToday);

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
    if (!progress || progress.state === State.New) continue;
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
        retrievability: scheduler.get_retrievability(toFsrsCard(progress), now, false),
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
  const newResetAt = getStudyDayStart(now);
  newResetAt.setDate(newResetAt.getDate() + 1);

  return {
    learning,
    reviews,
    reviewsSinceNew,
    reviewsPerNewCard: settings.reviewsPerNewCard,
    introducedToday,
    newRemainingToday,
    newBlocked,
    nextDue,
    newResetAt,
  };
}

export function buildStudyQueue(
  plan: ReturnType<typeof planStudyQueue>,
  availableNewCards: StudyCard[],
) {
  const newCards = plan.newBlocked
    ? []
    : availableNewCards.slice(0, plan.newRemainingToday);
  const queue: StudyItem[] = [...plan.learning];
  let reviewsSinceNew = plan.reviewsSinceNew;
  let reviewIndex = 0;
  let newIndex = 0;
  while (reviewIndex < plan.reviews.length || newIndex < newCards.length) {
    if (
      newIndex < newCards.length &&
      (reviewsSinceNew >= plan.reviewsPerNewCard || reviewIndex === plan.reviews.length)
    ) {
      queue.push({ ...newCards[newIndex++], kind: "new", retrievability: null });
      reviewsSinceNew = 0;
    } else {
      queue.push(plan.reviews[reviewIndex++]);
      reviewsSinceNew++;
    }
  }

  return {
    queue,
    learningCount: plan.learning.length,
    reviewCount: plan.reviews.length,
    newCount: newCards.length,
    introducedToday: plan.introducedToday,
    newRemainingToday: plan.newRemainingToday,
    newBlocked: plan.newBlocked,
    nextDue: plan.nextDue,
    newResetAt: plan.newResetAt,
  };
}
