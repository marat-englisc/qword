import { State, type Card, type RecordLogItem } from "ts-fsrs";
import { StudyCardUnavailableError } from "../lib/studyErrors";
import type { userCardMeaningTable } from "./schemas/user/userCardMeaning";

type Progress = typeof userCardMeaningTable.$inferSelect;

// FSRS logs describe the state before the answer. Comparing it inside the write
// transaction prevents an old preview or simultaneous answer losing progress.
export function validateReview(
  progress: Progress | undefined,
  result: RecordLogItem,
) {
  const { card, log } = result;
  if (!progress) {
    if (log.state === State.New && card.reps === 1) return;
  } else if (
    log.state === progress.state &&
    log.stability === progress.stability &&
    log.difficulty === progress.difficulty &&
    log.scheduled_days === progress.scheduledDays &&
    log.learning_steps === progress.learningSteps &&
    log.last_elapsed_days === progress.elapsedDays &&
    log.due.getTime() === (progress.lastReview ?? progress.due).getTime() &&
    card.reps === progress.reps + 1 &&
    (!progress.lastReview || log.review >= progress.lastReview)
  ) {
    return;
  }
  throw new StudyCardUnavailableError(
    "Карточка уже изменилась. Обновите её перед следующим ответом.",
  );
}

export function getProgressValues(cardMeaningId: number, card: Card) {
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
