import { createEmptyCard, Rating, State, type Grade } from "ts-fsrs";
import {
  getNewStudyCards,
  getScheduledStudyCards,
  getStudyCard,
  getStudyReviewsToday,
  type StudyCard,
} from "@/db/repositories/studyRepository";
import { saveUserCardMeaningReview } from "@/db/repositories/userRepository";
import { createScheduler, toFsrsCard } from "./scheduler";
import { getSettings } from "@/db/repositories/settingsRepository";
import { defaultSettings, type StudySettings } from "./settings";
import { StudyCardUnavailableError } from "./studyErrors";
import {
  buildStudyQueue,
  getStudyDayStart,
  planStudyQueue,
  type StudyOptions,
} from "./studyQueue";

export { getStudyDayStart, studySettings } from "./studyQueue";
export type { StudyItem, StudyOptions } from "./studyQueue";

export async function getStudyQueue(
  options: StudyOptions = {},
  now = new Date(),
) {
  const settings = await getSettings();
  const configured = { ...settings, ...options };
  const [scheduled, history] = await Promise.all([
    getScheduledStudyCards(),
    getStudyReviewsToday(getStudyDayStart(now, configured.dayStartHour), now),
  ]);
  const plan = planStudyQueue(scheduled, history, configured, now);
  const newCards =
    plan.newBlocked || plan.newRemainingToday === 0
      ? []
      : await getNewStudyCards(plan.newRemainingToday, options.deckId);
  return buildStudyQueue(plan, newCards);
}

export async function getNextStudyCard(
  options: StudyOptions = {},
  now = new Date(),
) {
  const result = await getStudyQueue(options, now);
  return { ...result, card: result.queue[0] ?? null };
}

export function previewStudyCard(card: StudyCard, now = new Date(), settings: StudySettings = defaultSettings) {
  const progress = card.progress
    ? toFsrsCard(card.progress)
    : createEmptyCard(now);
  return createScheduler(settings).repeat(progress, now);
}

export async function answerStudyCard(
  cardMeaningId: number,
  rating: Grade,
  now = new Date(),
) {
  if (!Number.isSafeInteger(cardMeaningId) || cardMeaningId <= 0)
    throw new Error("Некорректный идентификатор карточки.");
  if (![Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].includes(rating))
    throw new Error("Некорректная оценка ответа.");
  if (!Number.isFinite(now.getTime()))
    throw new Error("Некорректная дата ответа.");

  const [card, settings] = await Promise.all([getStudyCard(cardMeaningId), getSettings()]);
  if (!card)
    throw new StudyCardUnavailableError(
      "Карточка не найдена в добавленных колодах.",
    );

  const progress = card.progress
    ? toFsrsCard(card.progress)
    : createEmptyCard(now);
  if (progress.state !== State.New && progress.due > now)
    throw new StudyCardUnavailableError(
      "Срок повторения карточки ещё не наступил.",
    );

  const result = createScheduler(settings).next(progress, now, rating);
  await saveUserCardMeaningReview(cardMeaningId, result, {
    dayStart: getStudyDayStart(now, settings.dayStartHour),
    maxNewCards: settings.newCardsPerDay,
    maxReviewCards: settings.reviewsPerDay,
  });
  return result;
}
