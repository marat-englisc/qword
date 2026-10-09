import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyCard, Rating, State } from "ts-fsrs";
import { scheduler, toFsrsCard } from "../src/lib/scheduler";
import {
  buildStudyQueue,
  getStudyDayStart,
  planStudyQueue,
} from "../src/lib/studyQueue";
import { studyCard, studyNow } from "./studyFixtures";

test("study day resets at local 04:00, including the preceding calendar day", () => {
  const before = new Date(2026, 9, 9, 3, 59, 59);
  const boundary = new Date(2026, 9, 9, 4);
  assert.equal(getStudyDayStart(before).getTime(), new Date(2026, 9, 8, 4).getTime());
  assert.equal(getStudyDayStart(boundary).getTime(), boundary.getTime());
  const result = buildStudyQueue(planStudyQueue([], [], {}, before), []);
  assert.equal(result.newResetAt.getTime(), boundary.getTime());
});

test("daily budget counts distinct introduced meanings across all decks", () => {
  const history = [
    { cardMeaningId: 1, state: State.Review },
    { cardMeaningId: 2, state: State.New },
    { cardMeaningId: 2, state: State.New },
    { cardMeaningId: 3, state: State.New },
  ];
  const plan = planStudyQueue([], history, { newCardsPerDay: 3, deckId: 1 }, studyNow);
  const result = buildStudyQueue(plan, [studyCard(4), studyCard(5)]);
  assert.equal(result.introducedToday, 2);
  assert.equal(result.newRemainingToday, 1);
  assert.deepEqual(result.queue.map((card) => card.meaning.id), [4]);
});

test("exhausted daily budget never introduces more new meanings", () => {
  const history = Array.from({ length: 11 }, (_, index) => ({
    cardMeaningId: index + 1,
    state: State.New,
  }));
  const result = buildStudyQueue(planStudyQueue([], history, {}, studyNow), [studyCard(12)]);
  assert.equal(result.newRemainingToday, 0);
  assert.equal(result.newCount, 0);
  assert.deepEqual(result.queue, []);
});

test("due learning precedes reviews; future cards wait until their exact due time", () => {
  const future = new Date(studyNow.getTime() + 60_000);
  const scheduled = [
    studyCard(1, { state: State.Review }),
    studyCard(2, { state: State.Learning, due: new Date(studyNow.getTime() - 60_000) }),
    studyCard(3, { state: State.Relearning, due: future }),
  ];
  const result = buildStudyQueue(planStudyQueue(scheduled, [], {}, studyNow), [studyCard(4)]);
  assert.deepEqual(result.queue.map((card) => card.meaning.id), [2, 1, 4]);
  assert.equal(result.learningCount, 1);
  assert.equal(result.reviewCount, 1);
  assert.equal(result.nextDue?.getTime(), future.getTime());
  const after = planStudyQueue(scheduled, [], {}, future);
  assert.deepEqual(after.learning.map((card) => card.meaning.id), [2, 3]);
  assert.equal(after.nextDue, null);
});

test("reviews with a greater forgetting risk are shown first", () => {
  const scheduled = [
    studyCard(1, { state: State.Review, stability: 100 }),
    studyCard(2, { state: State.Review, stability: 0.1 }),
  ];
  const result = buildStudyQueue(planStudyQueue(scheduled, [], {}, studyNow), []);
  assert.deepEqual(result.queue.map((card) => card.meaning.id), [2, 1]);
  assert.ok(result.queue[0].retrievability! < result.queue[1].retrievability!);
});

test("review/new mixing continues from saved history rather than each fresh session", () => {
  const scheduled = Array.from({ length: 5 }, (_, index) => studyCard(index + 1, { state: State.Review }));
  const history = [
    { cardMeaningId: 30, state: State.Review },
    { cardMeaningId: 31, state: State.Learning },
    { cardMeaningId: 32, state: State.Review },
    { cardMeaningId: 33, state: State.New },
  ];
  const result = buildStudyQueue(planStudyQueue(scheduled, history, {}, studyNow), [studyCard(10), studyCard(11)]);
  assert.deepEqual(result.queue.map((card) => card.kind), ["review", "new", "review", "review", "review", "new", "review"]);
});

test("backlog limits are global while cards and next due are scoped to the selected deck", () => {
  const scheduled = [
    studyCard(1, { state: State.Review, deckId: 2 }),
    studyCard(2, { state: State.Review, deckId: 2 }),
    studyCard(3, { state: State.Learning, deckId: 1, due: new Date(studyNow.getTime() + 120_000) }),
    studyCard(4, { state: State.Review, deckId: 2, due: new Date(studyNow.getTime() + 60_000) }),
  ];
  const plan = planStudyQueue(scheduled, [], { deckId: 1, maxDueReviewsForNew: 1 }, studyNow);
  const result = buildStudyQueue(plan, [studyCard(5)]);
  assert.equal(result.newBlocked, true);
  assert.deepEqual(result.queue, []);
  assert.equal(result.nextDue?.getTime(), scheduled[2].progress!.due.getTime());
});

test("future learning cards also reserve the global learning capacity", () => {
  const scheduled = [studyCard(1, { state: State.Learning, due: new Date(studyNow.getTime() + 60_000) })];
  const result = buildStudyQueue(planStudyQueue(scheduled, [], { maxLearningCardsForNew: 1 }, studyNow), [studyCard(2)]);
  assert.equal(result.newBlocked, true);
  assert.equal(result.newCount, 0);
});

test("FSRS schedules configured learning steps and never mutates the input card", () => {
  const original = createEmptyCard(studyNow);
  const first = scheduler.next(original, studyNow, Rating.Again);
  assert.equal(first.card.state, State.Learning);
  assert.equal(first.card.due.getTime() - studyNow.getTime(), 60_000);
  assert.equal(original.state, State.New);
  assert.equal(original.reps, 0);
  const next = scheduler.next(first.card, first.card.due, Rating.Good);
  assert.equal(next.card.state, State.Learning);
  assert.equal(next.card.due.getTime() - first.card.due.getTime(), 600_000);
  const graduated = scheduler.next(next.card, next.card.due, Rating.Good);
  assert.equal(graduated.card.state, State.Review);
  assert.ok(graduated.card.due > next.card.due);
});

test("stored progress retains all FSRS scheduling fields", () => {
  const stored = studyCard(1, { state: State.Relearning }).progress!;
  stored.learningSteps = 1;
  stored.lapses = 2;
  stored.reps = 6;
  const restored = toFsrsCard(stored);
  const preview = scheduler.repeat(restored, studyNow);
  const result = scheduler.next(restored, studyNow, Rating.Good);
  assert.deepEqual(result, preview[Rating.Good]);
  assert.equal(restored.learning_steps, 1);
  assert.equal(result.card.reps, 7);
  assert.equal(result.card.lapses, 2);
});

test("invalid limits and deck IDs fail rather than producing malformed queues", () => {
  for (const newCardsPerDay of [-1, 0.5, Infinity, NaN])
    assert.throws(() => planStudyQueue([], [], { newCardsPerDay }, studyNow));
  for (const deckId of [-1, 0, 1.5, NaN])
    assert.throws(() => planStudyQueue([], [], { deckId }, studyNow));
});
