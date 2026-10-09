import { State } from "ts-fsrs";
import type { StudyCard } from "../src/db/repositories/studyRepository";

export const studyNow = new Date(2026, 9, 9, 12);

export function studyCard(
  id: number,
  options: {
    deckId?: number;
    state?: State;
    due?: Date;
    stability?: number;
    lastReview?: Date;
  } = {},
): StudyCard {
  const { deckId = 1, state, due = studyNow, stability = 1, lastReview } = options;
  return {
    word: {
      id,
      deckId,
      title: `word ${id}`,
      transcription: null,
      audioUrl: null,
      createdAt: "2026-10-09",
      updatedAt: "2026-10-09",
    },
    meaning: {
      id,
      cardId: id,
      hint: null,
      meaning: `meaning ${id}`,
      meaningTranslation: `перевод ${id}`,
      createdAt: "2026-10-09",
      updatedAt: "2026-10-09",
    },
    progress: state === undefined ? null : {
      id,
      cardMeaningId: id,
      state,
      due,
      stability,
      difficulty: 5,
      elapsedDays: 1,
      scheduledDays: 1,
      learningSteps: 0,
      reps: 1,
      lapses: 0,
      lastReview: lastReview ?? new Date(studyNow.getTime() - 86_400_000),
    },
  };
}
