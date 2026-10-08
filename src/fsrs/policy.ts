import { getStudyDay } from "./time";
import type { StudyPolicy } from "./types";

export const DEFAULT_STUDY_POLICY: Readonly<StudyPolicy> = Object.freeze({
  dailyNewLimit: 20,
  dailyReviewLimit: 200,
  newCardEvery: 5,
  backlogSoftLimit: 50,
  backlogHardLimit: 200,
  siblingSpacing: 3,
  queueLimit: 20,
  timeZone: "UTC",
});

export function resolveStudyPolicy(
  options: Partial<StudyPolicy> = {},
): Readonly<StudyPolicy> {
  const policy = { ...DEFAULT_STUDY_POLICY, ...options };
  for (const key of [
    "dailyNewLimit",
    "dailyReviewLimit",
    "backlogSoftLimit",
    "backlogHardLimit",
    "siblingSpacing",
    "queueLimit",
    "newCardEvery",
  ] as const) {
    if (!Number.isSafeInteger(policy[key]) || policy[key] < 0) {
      throw new RangeError(`${key} must be a non-negative safe integer`);
    }
  }
  if (
    policy.newCardEvery < 1 ||
    policy.queueLimit > 1000 ||
    policy.siblingSpacing > 100 ||
    policy.dailyNewLimit > 1000 ||
    policy.dailyReviewLimit > 100_000 ||
    policy.backlogHardLimit <= policy.backlogSoftLimit
  ) {
    throw new RangeError("Invalid study limits, spacing or backlog thresholds");
  }
  getStudyDay(new Date(), policy.timeZone);
  return Object.freeze(policy);
}

export function getEffectiveNewLimit(
  policy: Readonly<StudyPolicy>,
  dueReviewCount: number,
) {
  if (dueReviewCount <= policy.backlogSoftLimit) return policy.dailyNewLimit;
  if (dueReviewCount >= policy.backlogHardLimit) return 0;
  return Math.floor(
    (policy.dailyNewLimit * (policy.backlogHardLimit - dueReviewCount)) /
      (policy.backlogHardLimit - policy.backlogSoftLimit),
  );
}
