import { createHash } from "node:crypto";
import {
  checkParameters,
  createEmptyCard,
  fsrs,
  FSRSVersion,
  GenSeedStrategyWithCardId,
  Grades,
  State,
  StrategyMode,
  type Card,
  type FSRSParameters,
  type Grade,
  type RecordLogItem,
} from "ts-fsrs";
import type { UserCardMeaning } from "../../db/repositories/user/userCardMeaningRepository";
import { validateDate } from "./time";
import { StudyError, type ScheduledReview } from "./types";

const DAY_MS = 86_400_000;

export function validateGrade(value: number): asserts value is Grade {
  if (!Number.isInteger(value) || value < 1 || value > 4) {
    throw new RangeError(
      "rating must be an integer: Again=1, Hard=2, Good=3, Easy=4",
    );
  }
}

function validateSettings(settings: Partial<FSRSParameters>) {
  if (
    settings.request_retention !== undefined &&
    (!Number.isFinite(settings.request_retention) ||
      settings.request_retention <= 0 ||
      settings.request_retention >= 1)
  ) {
    throw new RangeError(
      "request_retention must be between 0 and 1 exclusively",
    );
  }
  if (
    settings.maximum_interval !== undefined &&
    (!Number.isSafeInteger(settings.maximum_interval) ||
      settings.maximum_interval < 1 ||
      settings.maximum_interval > 36_500)
  ) {
    throw new RangeError(
      "maximum_interval must be an integer between 1 and 36500 days",
    );
  }
  for (const key of ["enable_fuzz", "enable_short_term"] as const) {
    if (settings[key] !== undefined && typeof settings[key] !== "boolean") {
      throw new TypeError(`${key} must be a boolean`);
    }
  }
  if (settings.w !== undefined) {
    if (
      !Array.isArray(settings.w) ||
      settings.w.length !== 21 ||
      Array.from(settings.w).some((value) => !Number.isFinite(value))
    ) {
      throw new RangeError("FSRS 6 requires exactly 21 finite weights");
    }
    checkParameters(settings.w);
  }
  for (const key of ["learning_steps", "relearning_steps"] as const) {
    const steps = settings[key];
    if (steps === undefined) continue;
    if (!Array.isArray(steps)) throw new TypeError(`${key} must be an array`);
    let previous = 0;
    for (const step of steps) {
      const match = /^(\d+)(m|h)$/.exec(step);
      const minutes = match
        ? Number(match[1]) * (match[2] === "h" ? 60 : 1)
        : NaN;
      if (
        !Number.isSafeInteger(minutes) ||
        minutes <= previous ||
        minutes >= 1440
      ) {
        throw new RangeError(
          `${key} must contain increasing positive steps shorter than one day`,
        );
      }
      previous = minutes;
    }
  }
}

export function validateProgress(progress: UserCardMeaning, now: Date) {
  const invalid = (message: string): never => {
    throw new StudyError(
      "INVALID_PROGRESS",
      `Progress ${progress.id}: ${message}`,
    );
  };
  if (
    !Number.isInteger(progress.state) ||
    progress.state < 0 ||
    progress.state > 3
  ) {
    invalid("invalid state");
  }
  if (
    !Number.isFinite(progress.stability) ||
    progress.stability < 0 ||
    !Number.isFinite(progress.difficulty) ||
    progress.difficulty < 0 ||
    progress.difficulty > 10
  ) {
    invalid("invalid stability or difficulty");
  }
  for (const key of [
    "elapsedDays",
    "scheduledDays",
    "learningSteps",
    "reps",
    "lapses",
  ] as const) {
    if (!Number.isSafeInteger(progress[key]) || progress[key] < 0) {
      invalid(`invalid ${key}`);
    }
  }
  try {
    validateDate(progress.due, "due");
    if (progress.lastReview !== null)
      validateDate(progress.lastReview, "lastReview");
  } catch {
    invalid("invalid date");
  }
  if (progress.lastReview && progress.lastReview.getTime() > now.getTime()) {
    invalid("lastReview is in the future");
  }
  if (
    progress.state !== State.New &&
    (!progress.lastReview || progress.stability <= 0 || progress.difficulty < 1)
  ) {
    invalid(
      "a learned card needs lastReview, positive stability and difficulty >= 1",
    );
  }
}

export function toFsrsCard(progress: UserCardMeaning): Card {
  return {
    due: new Date(progress.due),
    stability: progress.stability,
    difficulty: progress.difficulty,
    elapsed_days: progress.elapsedDays,
    scheduled_days: progress.scheduledDays,
    learning_steps: progress.learningSteps,
    reps: progress.reps,
    lapses: progress.lapses,
    state: progress.state,
    last_review: progress.lastReview
      ? new Date(progress.lastReview)
      : undefined,
  };
}

export function getProgressVersion(
  userId: number,
  cardMeaningId: number,
  progress: UserCardMeaning | null,
): string {
  const snapshot = progress
    ? [
        progress.id,
        progress.userId,
        progress.cardMeaningId,
        progress.due.getTime(),
        progress.stability,
        progress.difficulty,
        progress.elapsedDays,
        progress.scheduledDays,
        progress.learningSteps,
        progress.reps,
        progress.lapses,
        progress.state,
        progress.lastReview?.getTime() ?? null,
      ]
    : null;
  return createHash("sha256")
    .update(JSON.stringify([userId, cardMeaningId, snapshot]))
    .digest("hex")
    .slice(0, 32);
}

function mapResult(
  result: RecordLogItem,
  maximumInterval: number,
): ScheduledReview {
  const { card, log } = result;
  validateDate(card.due, "next due");
  validateDate(card.last_review!, "last review");
  validateDate(log.due, "log due");
  validateDate(log.review, "log review");
  // TS-FSRS can add one/two days after applying its interval ceiling to keep
  // Hard/Good/Easy ordered. The application's ceiling applies to the final
  // schedule; at the ceiling equal intervals are allowed. Memory and the log
  // describing the previous card remain exactly as calculated by TS-FSRS.
  const scheduledDays = Math.min(card.scheduled_days, maximumInterval);
  const due =
    scheduledDays === card.scheduled_days
      ? new Date(card.due)
      : new Date(card.last_review!.getTime() + scheduledDays * DAY_MS);
  validateDate(due, "next due");
  return {
    progress: {
      due,
      stability: card.stability,
      difficulty: card.difficulty,
      elapsedDays: card.elapsed_days,
      scheduledDays,
      learningSteps: card.learning_steps,
      reps: card.reps,
      lapses: card.lapses,
      state: card.state,
      lastReview: new Date(card.last_review!),
    },
    review: {
      rating: log.rating,
      state: log.state,
      due: new Date(log.due),
      stability: log.stability,
      difficulty: log.difficulty,
      scheduledDays: log.scheduled_days,
      elapsedDays: log.elapsed_days,
      lastElapsedDays: log.last_elapsed_days,
      learningSteps: log.learning_steps,
      review: new Date(log.review),
    },
  };
}

export function createFsrsEngine(settings: Partial<FSRSParameters> = {}) {
  validateSettings(settings);
  if (!FSRSVersion.includes("FSRS-6")) {
    throw new Error(`Expected FSRS 6, found ${FSRSVersion}`);
  }
  const scheduler = fsrs({
    ...settings,
    w: settings.w ? [...settings.w] : undefined,
    learning_steps: settings.learning_steps
      ? [...settings.learning_steps]
      : undefined,
    relearning_steps: settings.relearning_steps
      ? [...settings.relearning_steps]
      : undefined,
    enable_fuzz: settings.enable_fuzz ?? true,
  });
  scheduler.useStrategy(
    StrategyMode.SEED,
    GenSeedStrategyWithCardId("studySeed"),
  );

  const input = (progress: UserCardMeaning | null, now: Date, seed: string) => {
    validateDate(now);
    if (progress) validateProgress(progress, now);
    return {
      ...(progress ? toFsrsCard(progress) : createEmptyCard(new Date(now))),
      studySeed: seed,
    };
  };

  return {
    version: FSRSVersion,
    getParameters(): FSRSParameters {
      const parameters = scheduler.parameters;
      return {
        ...parameters,
        w: [...parameters.w],
        learning_steps: [...parameters.learning_steps],
        relearning_steps: [...parameters.relearning_steps],
      };
    },
    schedule(
      progress: UserCardMeaning | null,
      rating: Grade,
      now: Date,
      seed = "study:",
    ): ScheduledReview {
      validateGrade(rating);
      return mapResult(
        scheduler.next(input(progress, now, seed), new Date(now), rating),
        scheduler.parameters.maximum_interval,
      );
    },
    preview(progress: UserCardMeaning | null, now: Date, seed = "study:") {
      const results = scheduler.repeat(
        input(progress, now, seed),
        new Date(now),
      );
      const outcomes = {} as Record<Grade, ScheduledReview>;
      for (const grade of Grades) {
        outcomes[grade] = mapResult(
          results[grade],
          scheduler.parameters.maximum_interval,
        );
      }
      return outcomes;
    },
    retrievability(progress: UserCardMeaning, now: Date): number | null {
      validateDate(now);
      validateProgress(progress, now);
      if (progress.state === State.New) return null;
      const elapsedDays = Math.max(
        0,
        (now.getTime() - progress.lastReview!.getTime()) / DAY_MS,
      );
      return scheduler.forgetting_curve(elapsedDays, progress.stability);
    },
  };
}

export type FsrsEngine = ReturnType<typeof createFsrsEngine>;
