import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createEmptyCard, Rating, State } from "ts-fsrs";
import { createSQLiteClient } from "../src/config/sqliteAdapter";
import { migrateUserData } from "../src/db/migrateUserData";
import { readDeckSummaries } from "../src/db/queries/deckSummaries";
import { removeDeck } from "../src/db/queries/removeDeck";
import { readSettings, writeSettings } from "../src/db/queries/settings";
import { readStatistics } from "../src/db/queries/statistics";
import { saveReview } from "../src/db/queries/saveReview";
import { getProgressValues } from "../src/db/reviewProgress";
import { userCardMeaningTable } from "../src/db/schemas/user/userCardMeaning";
import { userCardMeaningReviewTable } from "../src/db/schemas/user/userCardMeaningReview";
import { createScheduler } from "../src/lib/scheduler";
import { defaultSettings, getStudyDayStart, parseLearningSteps, validateSettings } from "../src/lib/settings";
import { activityDays, calculateStreaks, emptyActivity, localDateKey, summarizeActivity } from "../src/lib/statistics";
import { buildStudyQueue, planStudyQueue } from "../src/lib/studyQueue";
import { createTestDatabase } from "./helpers/sqlite";
import { studyCard, studyNow } from "./studyFixtures";

const schema = readFileSync("drizzle/20261008224747_condemned_trish_tilby/migration.sql", "utf8");

async function fixture() {
  const result = createTestDatabase(schema);
  await migrateUserData(result.database);
  result.raw.exec(`
    INSERT INTO deck(id, name, updated_at) VALUES(1, 'Active', '2026-10-09'), (2, 'Paused', '2026-10-09');
    INSERT INTO user_deck(deck_id) VALUES(1), (2);
    INSERT INTO card(id, deck_id, title, updated_at) VALUES(1, 1, 'one', '2026-10-09'), (2, 1, 'two', '2026-10-09'), (3, 2, 'three', '2026-10-09'), (4, 1, 'four', '2026-10-09');
    INSERT INTO card_meaning(id, card_id, meaning, meaning_translation, updated_at)
    VALUES(1, 1, 'one', 'один', '2026-10-09'), (2, 2, 'two', 'два', '2026-10-09'), (3, 3, 'three', 'три', '2026-10-09'), (4, 4, 'four', 'четыре', '2026-10-09');
  `);
  return { ...result, ...createSQLiteClient(() => result.database) };
}

test("settings migration upgrades an installed v1 database and preserves saved settings on restart", async () => {
  const f = await fixture();
  try {
    f.raw.exec("DROP TABLE app_settings; DELETE FROM app_migrations WHERE version = 2");
    await migrateUserData(f.database);
    assert.deepEqual(await readSettings(f.db), defaultSettings);
    const custom = { ...defaultSettings, newCardsPerDay: 7, reviewsPerDay: 2, dayStartHour: 7, requestRetention: 0.95, learningSteps: [2, 15] };
    await f.runDatabaseTransaction((tx) => writeSettings(tx, custom));
    await migrateUserData(f.database);
    assert.deepEqual(await readSettings(f.db), custom);
    assert.equal(f.raw.prepare("SELECT COUNT(*) AS count FROM app_migrations").get()?.count, 2);
    await assert.rejects(writeSettings(f.db, { ...custom, newCardsPerDay: -1 }));
    assert.deepEqual(await readSettings(f.db), custom);
  } finally { f.close(); }
});

test("malformed settings and learning steps are rejected; disabled daily limits and empty steps are valid", () => {
  for (const value of [-1, 0.5, NaN, Infinity, 201]) assert.throws(() => validateSettings({ ...defaultSettings, newCardsPerDay: value }));
  for (const value of [0.69, 1, NaN]) assert.throws(() => validateSettings({ ...defaultSettings, requestRetention: value }));
  for (const steps of [[10, 1], [1, 1], [0], [1441], [1.5]]) assert.throws(() => validateSettings({ ...defaultSettings, learningSteps: steps }));
  for (const text of ["1.5, 10", "abc", "1,,", "1m, 10m"]) assert.throws(() => parseLearningSteps(text));
  assert.deepEqual(parseLearningSteps(" 1, 10; 30 "), [1, 10, 30]);
  assert.deepEqual(validateSettings({ ...defaultSettings, newCardsPerDay: 0, reviewsPerDay: 0, learningSteps: [] }).learningSteps, []);
});

test("custom FSRS retention, maximum interval and learning steps affect real scheduling", () => {
  const scheduler = createScheduler({ ...defaultSettings, learningSteps: [3, 20], maximumInterval: 2 });
  const first = scheduler.next(createEmptyCard(studyNow), studyNow, Rating.Again);
  assert.equal(first.card.due.getTime() - studyNow.getTime(), 180_000);
  const next = scheduler.next(first.card, first.card.due, Rating.Good);
  assert.equal(next.card.due.getTime() - first.card.due.getTime(), 1_200_000);
  const mature = { ...createEmptyCard(studyNow), state: State.Review, stability: 100, difficulty: 5, reps: 10, last_review: new Date(studyNow.getTime() - 86_400_000) };
  assert.ok(scheduler.next(mature, studyNow, Rating.Good).card.scheduled_days <= 2);
  const preview = scheduler.repeat(mature, studyNow);
  for (const grade of [Rating.Hard, Rating.Good, Rating.Easy] as const) {
    assert.ok(preview[grade].card.scheduled_days <= 2);
    assert.deepEqual(preview[grade], scheduler.next(mature, studyNow, grade));
  }
  const higher = createScheduler({ ...defaultSettings, requestRetention: 0.95 });
  const lower = createScheduler({ ...defaultSettings, requestRetention: 0.8 });
  assert.ok(higher.next(mature, studyNow, Rating.Good).card.scheduled_days < lower.next(mature, studyNow, Rating.Good).card.scheduled_days);
  const longTerm = createScheduler({ ...defaultSettings, enableShortTerm: false });
  assert.equal(longTerm.next(createEmptyCard(studyNow), studyNow, Rating.Good).card.state, State.Review);
});

test("review quota counts distinct meanings globally and leaves short learning steps available", () => {
  const scheduled = [studyCard(1, { state: State.Review }), studyCard(2, { state: State.Review, deckId: 2 }), studyCard(3, { state: State.Learning })];
  const history = [{ cardMeaningId: 10, state: State.Review }, { cardMeaningId: 10, state: State.Review }, { cardMeaningId: 11, state: State.Review }];
  const result = buildStudyQueue(planStudyQueue(scheduled, history, { reviewsPerDay: 2, newCardsPerDay: 0, deckId: 1 }, studyNow), []);
  assert.equal(result.reviewedToday, 2);
  assert.equal(result.reviewRemainingToday, 0);
  assert.equal(result.reviewLimited, true);
  assert.deepEqual(result.queue.map((card) => card.meaning.id), [3]);
  assert.equal(getStudyDayStart(new Date(2026, 9, 9, 6, 59), 7).getTime(), new Date(2026, 9, 8, 7).getTime());
});

test("unsubscribe preserves FSRS progress and logs, rejects answers, and allows resubscription", async () => {
  const f = await fixture();
  try {
    const result = createScheduler().next(createEmptyCard(studyNow), studyNow, Rating.Good);
    await f.runDatabaseTransaction((tx) => saveReview(tx, 1, result));
    const before = f.raw.prepare("SELECT * FROM user_card_meaning").all();
    await f.runDatabaseTransaction((tx) => removeDeck(tx, 1));
    await f.runDatabaseTransaction((tx) => removeDeck(tx, 1));
    assert.deepEqual(f.raw.prepare("SELECT * FROM user_card_meaning").all(), before);
    assert.equal(f.raw.prepare("SELECT COUNT(*) AS count FROM user_card_meaning_review").get()?.count, 1);
    const summaries = await readDeckSummaries(f.db, studyNow);
    assert.equal(summaries[0].added, false);
    assert.equal(summaries[0].studiedMeaningCount, 1);
    await assert.rejects(f.runDatabaseTransaction((tx) => saveReview(tx, 1, result)), /добавленных колодах/);
    f.raw.exec("INSERT INTO user_deck(deck_id) VALUES(1)");
    assert.equal((await readDeckSummaries(f.db, studyNow))[0].added, true);
    assert.deepEqual(f.raw.prepare("SELECT * FROM user_card_meaning").all(), before);
  } finally { f.close(); }
});

test("simultaneous reviews cannot exceed the final daily slot, but learning remains allowed", async () => {
  const f = await fixture();
  try {
    const scheduler = createScheduler();
    const card = { ...createEmptyCard(studyNow), state: State.Review, stability: 2, difficulty: 5, reps: 1, last_review: new Date(studyNow.getTime() - 86_400_000) };
    await f.db.insert(userCardMeaningTable).values([1, 2].map((id) => getProgressValues(id, card)));
    const policy = { dayStart: getStudyDayStart(studyNow), maxNewCards: 0, maxReviewCards: 1 };
    const result = scheduler.next(card, studyNow, Rating.Good);
    const answers = await Promise.allSettled([1, 2].map((id) => f.runDatabaseTransaction((tx) => saveReview(tx, id, result, policy))));
    assert.equal(answers.filter((answer) => answer.status === "fulfilled").length, 1);
    assert.equal(f.raw.prepare("SELECT COUNT(*) AS count FROM user_card_meaning_review").get()?.count, 1);
    const learning = scheduler.next(createEmptyCard(studyNow), studyNow, Rating.Again).card;
    await f.db.insert(userCardMeaningTable).values(getProgressValues(4, learning));
    await f.runDatabaseTransaction((tx) => saveReview(tx, 4, scheduler.next(learning, learning.due, Rating.Good), policy));
    assert.equal(f.raw.prepare("SELECT COUNT(*) AS count FROM user_card_meaning_review").get()?.count, 2);
  } finally { f.close(); }
});

test("statistics use pre-answer state, local day boundaries, retained history and active-deck forecasts", async () => {
  const f = await fixture();
  try {
    const scheduler = createScheduler();
    const reviewCard = { ...createEmptyCard(studyNow), state: State.Review, stability: 22, difficulty: 5, reps: 2, last_review: new Date(studyNow.getTime() - 86_400_000) };
    const learningCard = scheduler.next(createEmptyCard(studyNow), studyNow, Rating.Again).card;
    await f.db.insert(userCardMeaningTable).values([getProgressValues(1, reviewCard), getProgressValues(2, learningCard), getProgressValues(3, reviewCard)]);
    const logs = [
      { id: 1, card: createEmptyCard(studyNow), time: new Date(2026, 9, 9, 3, 59), grade: Rating.Again },
      { id: 1, card: reviewCard, time: new Date(2026, 9, 9, 4), grade: Rating.Again },
      { id: 2, card: learningCard, time: new Date(2026, 9, 9, 5), grade: Rating.Good },
      { id: 3, card: reviewCard, time: new Date(2026, 9, 9, 6), grade: Rating.Hard },
      { id: 3, card: reviewCard, time: new Date(2026, 9, 9, 7), grade: Rating.Easy },
      { id: 1, card: reviewCard, time: new Date(2026, 9, 10, 7), grade: Rating.Good },
    ] as const;
    for (const item of logs) {
      const log = scheduler.next(item.card, item.time, item.grade).log;
      await f.db.insert(userCardMeaningReviewTable).values({ cardMeaningId: item.id, userCardMeaningId: item.id,
        rating: log.rating, state: log.state, due: log.due, stability: log.stability, difficulty: log.difficulty,
        scheduledDays: log.scheduled_days, elapsedDays: log.elapsed_days, lastElapsedDays: log.last_elapsed_days,
        learningSteps: log.learning_steps, review: log.review });
    }
    f.raw.exec("UPDATE user_card_meaning SET lapses = 2 WHERE card_meaning_id = 1");
    f.raw.exec("UPDATE user_card_meaning_review SET rating = 0 WHERE id = 3");
    await removeDeck(f.db, 2);
    const stats = await readStatistics(f.db, defaultSettings, studyNow);
    assert.equal(stats.lifetime.answers, 4);
    assert.equal(stats.lifetime.recallRate, 67);
    assert.equal(stats.history[0].day, "2026-10-08");
    assert.equal(stats.history[1].answers, 3);
    assert.deepEqual(stats.vocabulary, { total: 3, fresh: 1, learning: 1, young: 0, mature: 1 });
    assert.equal(stats.forecast[0].count, 2);
    assert.deepEqual(stats.difficult.map((item) => item.id), [1]);
    assert.deepEqual(stats.streaks, { current: 2, best: 2 });
    f.raw.prepare("UPDATE user_card_meaning SET due = ? WHERE card_meaning_id = 1").run(studyNow.getTime() + 2 * 86_400_000);
    const forecast = await readStatistics(f.db, defaultSettings, studyNow);
    assert.equal(forecast.forecast[0].count, 1);
    assert.equal(forecast.forecast[2].count, 1);
    const changedDay = await readStatistics(f.db, { ...defaultSettings, dayStartHour: 7 }, studyNow);
    assert.equal(changedDay.history[0].day, "2026-10-08");
    assert.equal(changedDay.history[0].answers, 3);
  } finally { f.close(); }
});

test("activity fills empty dates and current streak tolerates an unfinished today but no missing yesterday", () => {
  const day = (date: string) => ({ ...emptyActivity(date), answers: 1 });
  const history = [day("2026-10-05"), day("2026-10-06"), day("2026-10-07"), day("2026-10-08")];
  assert.deepEqual(calculateStreaks(history, studyNow, 4), { current: 4, best: 4 });
  assert.deepEqual(calculateStreaks(history.slice(0, 3), studyNow, 4), { current: 0, best: 3 });
  const days = activityDays(history, 7, studyNow, 4);
  assert.equal(days.length, 7);
  assert.equal(days.at(-1)?.day, localDateKey(studyNow));
  assert.equal(days.at(-1)?.answers, 0);
  assert.equal(summarizeActivity(days).recallRate, null);
});
