import { date_scheduler, fsrs, Rating, State, type Card, type Grade, type RecordLogItem } from "ts-fsrs";
import type { userCardMeaningTable } from "@/db/schemas/user/userCardMeaning";
import { defaultSettings, type StudySettings } from "./settings";

export function toFsrsCard(
  progress: typeof userCardMeaningTable.$inferSelect,
): Card {
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

export function createScheduler(settings: StudySettings = defaultSettings) {
  const engine = fsrs({
    request_retention: settings.requestRetention,
    maximum_interval: settings.maximumInterval,
    enable_fuzz: settings.enableFuzz,
    enable_short_term: settings.enableShortTerm,
    learning_steps: settings.learningSteps.map((step) => `${step}m` as const),
    relearning_steps: settings.relearningSteps.map((step) => `${step}m` as const),
  });
  // TS-FSRS 5 keeps Good/Easy intervals above Hard, which can exceed a small
  // maximum_interval. Apply the user's ceiling to both previews and saved cards.
  const cap = (result: RecordLogItem, now: Date): RecordLogItem =>
    result.card.state === State.Review && result.card.scheduled_days > settings.maximumInterval
      ? { ...result, card: { ...result.card, scheduled_days: settings.maximumInterval,
        due: date_scheduler(now, settings.maximumInterval, true) } }
      : result;
  return {
    next: (card: Card, now: Date, rating: Grade) => engine.next(card, now, rating, (result) => cap(result, now)),
    repeat: (card: Card, now: Date) => engine.repeat(card, now, (preview) => {
      for (const rating of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const)
        preview[rating] = cap(preview[rating], now);
      return preview;
    }),
    get_retrievability: engine.get_retrievability.bind(engine),
  };
}

export const scheduler = createScheduler();

export const ratings: {
  value: Grade;
  label: string;
  color: string;
  background: string;
}[] = [
  {
    value: Rating.Again,
    label: "Снова",
    color: "#A04545",
    background: "#FAECE9",
  },
  {
    value: Rating.Hard,
    label: "Трудно",
    color: "#936321",
    background: "#FBF0DC",
  },
  {
    value: Rating.Good,
    label: "Помню",
    color: "#347163",
    background: "#E5F1EB",
  },
  {
    value: Rating.Easy,
    label: "Легко",
    color: "#6250A6",
    background: "#EEE8FA",
  },
];

export function formatInterval(due: Date | number, now = Date.now()) {
  const minutes = Math.max(
    1,
    Math.ceil((new Date(due).getTime() - now) / 60_000),
  );
  if (minutes < 60) return `${minutes} мин`;
  if (minutes < 1440) return `${Math.ceil(minutes / 60)} ч`;
  return `${Math.ceil(minutes / 1440)} дн`;
}
