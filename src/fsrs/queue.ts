import { State } from "ts-fsrs";
import {
  getProgressVersion,
  validateProgress,
  type FsrsEngine,
} from "./engine";
import { getEffectiveNewLimit } from "./policy";
import type {
  StudyCandidate,
  StudyDay,
  StudyItem,
  StudyPolicy,
  StudyQueue,
  StudySnapshot,
} from "./types";

const DAY_MS = 86_400_000;

export function getStudyBudget(
  snapshot: Pick<StudySnapshot, "activity" | "dueReviewCount">,
  policy: Readonly<StudyPolicy>,
) {
  const reviewRemaining = Math.max(
    0,
    policy.dailyReviewLimit - snapshot.activity.reviewedMeaningIds.length,
  );
  const effectiveNewLimit = getEffectiveNewLimit(
    policy,
    snapshot.dueReviewCount,
  );

  const newRemaining =
    reviewRemaining === 0 && snapshot.dueReviewCount > 0
      ? 0
      : Math.max(
          0,
          effectiveNewLimit - snapshot.activity.introducedMeaningIds.length,
        );
  return { reviewRemaining, newRemaining };
}

function describe(
  candidate: StudyCandidate,
  now: Date,
  day: StudyDay,
  engine: FsrsEngine,
): StudyItem {
  const { progress } = candidate;

  const version = "";
  if (!progress || progress.state === State.New) {
    if (progress) validateProgress(progress, now);
    return {
      ...candidate,
      version,
      reason: "new",
      priority: {
        score: 0,
        retrievability: null,
        overdueDays: 0,
        relativeOverdue: 0,
      },
    };
  }
  const retrievability = engine.retrievability(progress, now)!;
  const overdueDays = Math.max(
    0,
    (now.getTime() - progress.due.getTime()) / DAY_MS,
  );
  const relativeOverdue = overdueDays / Math.max(1, progress.scheduledDays);

  const score =
    0.7 * (1 - retrievability) +
    (0.15 * relativeOverdue) / (1 + relativeOverdue) +
    (0.1 * overdueDays) / (7 + overdueDays) +
    (0.03 * (progress.difficulty - 1)) / 9 +
    0.02 * Math.min(1, progress.lapses / Math.max(1, progress.reps));
  const reason =
    progress.state === State.Learning
      ? "learning"
      : progress.state === State.Relearning
        ? "relearning"
        : progress.due.getTime() < day.start.getTime()
          ? "overdue"
          : "due_today";
  return {
    ...candidate,
    version,
    reason,
    priority: { score, retrievability, overdueDays, relativeOverdue },
  };
}

function compareReview(left: StudyItem, right: StudyItem) {
  return (
    right.priority.score - left.priority.score ||
    left.progress!.due.getTime() - right.progress!.due.getTime() ||
    left.meaning.id - right.meaning.id
  );
}

function rotateNewDecks(
  items: StudyItem[],
  lastIntroducedDeckId?: number | null,
) {
  const decks = new Map<number, StudyItem[]>();
  for (const item of items) {
    const deck = decks.get(item.deck.id) ?? [];
    deck.push(item);
    decks.set(item.deck.id, deck);
  }
  const result: StudyItem[] = [];
  const entries = Array.from(decks).sort(([left], [right]) => left - right);
  const nextIndex =
    lastIntroducedDeckId === undefined || lastIntroducedDeckId === null
      ? 0
      : entries.findIndex(([id]) => id > lastIntroducedDeckId);
  const startIndex = Math.max(0, nextIndex);
  const rotated = [
    ...entries.slice(startIndex),
    ...entries.slice(0, startIndex),
  ];
  const maxLength = Math.max(0, ...rotated.map(([, deck]) => deck.length));
  for (let index = 0; index < maxLength; index++) {
    for (const [, deck] of rotated) if (deck[index]) result.push(deck[index]);
  }
  return result;
}

export function buildStudyQueue(
  snapshot: StudySnapshot,
  userId: number,
  now: Date,
  day: StudyDay,
  policy: Readonly<StudyPolicy>,
  engine: FsrsEngine,
  limit: number,
  recentCardIds: readonly number[] = [],
): StudyQueue {
  const due = snapshot.due.map((item) => describe(item, now, day, engine));
  const learning = due
    .filter(
      (item) => item.reason === "learning" || item.reason === "relearning",
    )
    .sort(
      (a, b) =>
        a.progress!.due.getTime() - b.progress!.due.getTime() ||
        a.meaning.id - b.meaning.id,
    );
  const review = due
    .filter((item) => item.progress!.state === State.Review)
    .sort(compareReview);
  const fresh = rotateNewDecks(
    snapshot.newCards.map((item) => describe(item, now, day, engine)),
    snapshot.activity.lastIntroducedDeckId,
  );
  const budget = getStudyBudget(snapshot, policy);
  let remainingReview = budget.reviewRemaining;
  let remainingNew = budget.newRemaining;
  let reviewsSinceNew = snapshot.activity.reviewsSinceLastNew;
  const introduced = new Set(snapshot.activity.introducedMeaningIds);
  const reviewed = new Set(snapshot.activity.reviewedMeaningIds);
  const recent =
    policy.siblingSpacing > 0
      ? [...recentCardIds].slice(-policy.siblingSpacing)
      : [];
  const dueLearning = learning.length;
  const items: StudyItem[] = [];

  const take = (pool: StudyItem[], eligible: (item: StudyItem) => boolean) => {
    const fallback = pool.findIndex(eligible);
    if (fallback < 0) return undefined;
    const spaced =
      policy.siblingSpacing > 0
        ? pool.findIndex(
            (item) => eligible(item) && !recent.includes(item.card.id),
          )
        : fallback;
    return pool.splice(spaced < 0 ? fallback : spaced, 1)[0]!;
  };
  while (items.length < limit) {
    let item = take(learning, () => true);
    if (!item) {
      const mayReview = (item: StudyItem) =>
        reviewed.has(item.meaning.id) || remainingReview > 0;
      const mayIntroduce = (item: StudyItem) =>
        introduced.has(item.meaning.id) || remainingNew > 0;
      const hasReview = review.some(mayReview);
      if (!hasReview || reviewsSinceNew >= policy.newCardEvery) {
        item = take(fresh, mayIntroduce);
      }
      item ??= take(review, mayReview);
      item ??= take(fresh, mayIntroduce);
    }
    if (!item) break;
    if (item.reason === "new") {
      if (!introduced.has(item.meaning.id)) remainingNew--;
      introduced.add(item.meaning.id);
      reviewsSinceNew = 0;
    } else if (item.progress!.state === State.Review) {
      if (!reviewed.has(item.meaning.id)) remainingReview--;
      reviewed.add(item.meaning.id);
      reviewsSinceNew++;
    }
    item.version = getProgressVersion(userId, item.meaning.id, item.progress);
    items.push(item);
    recent.push(item.card.id);
    while (recent.length > policy.siblingSpacing) recent.shift();
  }
  return {
    items,
    generatedAt: new Date(now),
    day,
    nextDueAt: snapshot.nextDueAt,
    counts: {
      dueLearning,
      dueReview: due.filter((item) => item.progress!.state === State.Review)
        .length,
      globalDueReview: snapshot.dueReviewCount,
      overdueReview: due.filter(
        (item) =>
          item.progress!.state === State.Review && item.reason === "overdue",
      ).length,
      introducedToday: snapshot.activity.introducedMeaningIds.length,
      reviewedToday: snapshot.activity.reviewedMeaningIds.length,
      answersToday: snapshot.activity.answers,
      ...budget,
    },
  };
}
