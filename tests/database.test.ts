import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createEmptyCard, fsrs, Rating, State } from "ts-fsrs";
import { importContent } from "../src/db/importContent";
import { migrateUserData } from "../src/db/migrateUserData";
import { readDeckSummaries } from "../src/db/queries/deckSummaries";
import { saveReview } from "../src/db/queries/saveReview";
import { getProgressValues, validateReview } from "../src/db/reviewProgress";
import { createSQLiteClient } from "../src/config/sqliteAdapter";
import { createTestDatabase } from "./helpers/sqlite";

const schema = readFileSync(
  "drizzle/20261008224747_condemned_trish_tilby/migration.sql",
  "utf8",
);
const migrationSql = readFileSync(
  "drizzle/20261009121324_unique_user_progress/migration.sql",
  "utf8",
);

function createContentDatabase() {
  const fixture = createTestDatabase(schema);
  fixture.raw.exec(`
    CREATE TABLE content_import(id INTEGER PRIMARY KEY, hash TEXT NOT NULL);
    INSERT INTO deck(id, name, updated_at) VALUES(1, 'Words', '2026-01-01');
    INSERT INTO card(id, deck_id, title, updated_at) VALUES(1, 1, 'word', '2026-01-01');
    INSERT INTO card_meaning(id, card_id, meaning, meaning_translation, updated_at)
    VALUES(1, 1, 'first', 'первое', '2026-01-01');
  `);
  return fixture;
}

function countRows(fixture: ReturnType<typeof createTestDatabase>, table: string) {
  return fixture.raw.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()?.count;
}

function addProgress(
  fixture: ReturnType<typeof createTestDatabase>,
  id: number,
  lastReview: number,
  reps: number,
) {
  fixture.raw.prepare(`INSERT INTO user_card_meaning
    (id, card_meaning_id, due, stability, difficulty, elapsed_days, scheduled_days,
     learning_steps, reps, lapses, state, last_review)
    VALUES(?, 1, ?, 1, 2, 1, 3, 0, ?, 0, 2, ?)
  `).run(id, lastReview + 60_000, reps, lastReview);
  fixture.raw.prepare(`INSERT INTO user_card_meaning_review
    (card_meaning_id, user_card_meaning_id, rating, state, due, stability, difficulty,
     scheduled_days, elapsed_days, last_elapsed_days, learning_steps, review)
    VALUES(1, ?, 3, 2, 0, 1, 2, 3, 1, 1, 0, ?)
  `).run(id, lastReview);
}

test("content update replaces examples and attributes while preserving progress and retired meanings", async () => {
  const target = createContentDatabase();
  const source = createContentDatabase();
  try {
    addProgress(target, 1, 1_000, 5);
    target.raw.exec(`
      INSERT INTO content_import VALUES(1, 'old');
      INSERT INTO card_meaning(id, card_id, meaning, meaning_translation, updated_at)
      VALUES(2, 1, 'retired', 'старое', '2026-01-01');
      INSERT INTO card_example VALUES(1, 1, 'stale', 'старый');
      INSERT INTO card_example VALUES(3, 2, 'retired example', 'старый пример');
      INSERT INTO attribute(id, name, updated_at) VALUES(1, 'type', '2026-01-01');
      INSERT INTO card_meaning_attribute(id, card_meaning_id, attribute_id, value, updated_at)
      VALUES(1, 1, 1, 'old', '2026-01-01');
    `);
    source.raw.exec(`
      UPDATE card_meaning SET meaning_translation = 'исправлено' WHERE id = 1;
      INSERT INTO card_example VALUES(2, 1, 'fresh', 'новый');
      INSERT INTO attribute(id, name, updated_at) VALUES(1, 'type', '2026-01-01');
      INSERT INTO card_meaning_attribute(id, card_meaning_id, attribute_id, value, updated_at)
      VALUES(2, 1, 1, 'new', '2026-01-01');
      INSERT INTO user_deck(deck_id) VALUES(1);
    `);
    addProgress(source, 10, 9_000, 100);

    const before = target.raw.prepare("SELECT * FROM user_card_meaning").all();
    await importContent(target.database, source.database, "new");
    assert.deepEqual(target.raw.prepare("SELECT * FROM user_card_meaning").all(), before);
    assert.equal(countRows(target, "user_card_meaning_review"), 1);
    assert.equal(countRows(target, "user_deck"), 0);
    assert.equal(
      target.raw.prepare("SELECT meaning_translation FROM card_meaning WHERE id = 1")
        .get()?.meaning_translation,
      "исправлено",
    );
    assert.equal(countRows(target, "card_meaning"), 2);
    assert.deepEqual(
      target.raw.prepare("SELECT id FROM card_example ORDER BY id")
        .all().map((row) => row.id),
      [2, 3],
    );
    assert.equal(target.raw.prepare("SELECT value FROM card_meaning_attribute").get()?.value, "new");
    assert.equal(target.raw.prepare("SELECT hash FROM content_import").get()?.hash, "new");
    assert.deepEqual(target.raw.prepare("PRAGMA foreign_key_check").all(), []);
    await importContent(target.database, source.database, "new-again");
    assert.equal(countRows(target, "card_example"), 2);
  } finally {
    target.close();
    source.close();
  }
});

test("failed content update rolls back content, examples and the import hash", async () => {
  const target = createContentDatabase();
  const source = createContentDatabase();
  try {
    target.raw.exec(`
      INSERT INTO content_import VALUES(1, 'old');
      INSERT INTO card_example VALUES(1, 1, 'original', 'пример');
    `);
    source.raw.exec(`
      UPDATE deck SET name = 'Changed';
      PRAGMA foreign_keys = OFF;
      INSERT INTO card_example VALUES(2, 999, 'invalid', 'ошибка');
    `);
    await assert.rejects(importContent(target.database, source.database, "invalid"));
    assert.equal(target.raw.prepare("SELECT name FROM deck").get()?.name, "Words");
    assert.equal(target.raw.prepare("SELECT hash FROM content_import").get()?.hash, "old");
    assert.equal(target.raw.prepare("SELECT example FROM card_example").get()?.example, "original");
    source.raw.exec("DELETE FROM card_example");
    await importContent(target.database, source.database, "valid");
    assert.equal(countRows(target, "card_example"), 0);
  } finally {
    target.close();
    source.close();
  }
});

for (const migration of ["runtime", "drizzle"] as const) {
  test(`${migration} migration merges duplicate memberships and progress without losing review history`, async () => {
    const fixture = createContentDatabase();
    try {
      fixture.raw.exec(`
        INSERT INTO user_deck(id, deck_id, created_at, last_reviewed_at)
        VALUES(1, 1, '2026-01-01', 1000), (2, 1, '2025-01-01', 3000);
      `);
      addProgress(fixture, 1, 1_000, 99);
      addProgress(fixture, 2, 2_000, 2);
      if (migration === "runtime") {
        await migrateUserData(fixture.database);
      } else {
        await fixture.database.withTransactionAsync(() =>
          fixture.database.execAsync(migrationSql),
        );
      }
      await migrateUserData(fixture.database);
      const memberships = fixture.raw.prepare("SELECT * FROM user_deck").all();
      assert.equal(memberships.length, 1);
      assert.equal(memberships[0].created_at, "2025-01-01");
      assert.equal(memberships[0].last_reviewed_at, 3_000);
      const progress = fixture.raw.prepare("SELECT * FROM user_card_meaning").all();
      assert.equal(progress.length, 1);
      assert.equal(progress[0].id, 2);
      assert.equal(progress[0].reps, 2);
      const reviews = fixture.raw.prepare(
        "SELECT user_card_meaning_id FROM user_card_meaning_review",
      ).all();
      assert.equal(reviews.length, 2);
      assert.ok(reviews.every((review) => review.user_card_meaning_id === 2));
      assert.throws(
        () => fixture.raw.exec("INSERT INTO user_deck(deck_id) VALUES(1)"),
        /UNIQUE/,
      );
      assert.throws(() => addProgress(fixture, 3, 3_000, 3), /UNIQUE/);
      assert.deepEqual(fixture.raw.prepare("PRAGMA foreign_key_check").all(), []);
    } finally {
      fixture.close();
    }
  });
}

test("FSRS review validation rejects stale first answers and preserves valid later reviews", () => {
  const scheduler = fsrs({ enable_fuzz: false });
  const now = new Date("2026-10-09T12:00:00Z");
  const first = scheduler.next(createEmptyCard(now), now, Rating.Good);
  validateReview(undefined, first);
  const progress = { id: 1, ...getProgressValues(1, first.card) };
  assert.throws(() => validateReview(progress, first), /уже изменилась/);
  const later = scheduler.next(first.card, first.card.due, Rating.Good);
  validateReview(progress, later);
  const nextProgress = { id: 1, ...getProgressValues(1, later.card) };
  assert.throws(() => validateReview(nextProgress, later), /уже изменилась/);
  assert.equal(nextProgress.reps, 2);
  assert.equal(nextProgress.lastReview?.getTime(), later.log.review.getTime());
  assert.notEqual(nextProgress.state, State.New);
});

test("deck summary SQL counts words once and handles empty decks, new meanings and due dates", async () => {
  const fixture = createContentDatabase();
  try {
    await migrateUserData(fixture.database);
    fixture.raw.exec(`
      INSERT INTO user_deck(deck_id) VALUES(1);
      INSERT INTO deck(id, name, updated_at) VALUES(2, 'Empty', '2026-01-01');
      INSERT INTO card(id, deck_id, title, updated_at) VALUES(2, 1, 'no meanings', '2026-01-01');
      INSERT INTO card_meaning(id, card_id, meaning, meaning_translation, updated_at)
      VALUES(2, 1, 'future', 'позже', '2026-01-01'),
            (3, 1, 'new', 'новое', '2026-01-01'),
            (4, 1, 'untouched', 'не изучено', '2026-01-01');
      INSERT INTO user_card_meaning
        (card_meaning_id, due, stability, difficulty, elapsed_days, scheduled_days,
         learning_steps, reps, lapses, state, last_review)
      VALUES(1, 1000, 1, 2, 1, 3, 0, 2, 0, 2, 500),
            (2, 3000, 1, 2, 1, 3, 0, 2, 0, 1, 500),
            (3, 500, 0, 0, 0, 0, 0, 0, 0, 0, NULL);
    `);
    const client = createSQLiteClient(() => fixture.database);
    const summaries = await readDeckSummaries(client.db, new Date(2_000));
    assert.deepEqual(summaries, [
      {
        id: 1, name: "Words", added: true, wordCount: 2, meaningCount: 4,
        studiedMeaningCount: 2, newMeaningCount: 2, reviewCount: 1,
        nextDue: new Date(3_000),
      },
      {
        id: 2, name: "Empty", added: false, wordCount: 0, meaningCount: 0,
        studiedMeaningCount: 0, newMeaningCount: 0, reviewCount: 0, nextDue: null,
      },
    ]);
  } finally {
    fixture.close();
  }
});

test("simultaneous first answers cannot exceed the last available daily slot", async () => {
  const fixture = createContentDatabase();
  try {
    await migrateUserData(fixture.database);
    fixture.raw.exec(`
      INSERT INTO user_deck(deck_id) VALUES(1);
      INSERT INTO card_meaning(id, card_id, meaning, meaning_translation, updated_at)
      VALUES(2, 1, 'second', 'второе', '2026-01-01');
    `);
    const client = createSQLiteClient(() => fixture.database);
    const scheduler = fsrs({ enable_fuzz: false });
    const now = new Date("2026-10-09T12:00:00Z");
    const result = scheduler.next(createEmptyCard(now), now, Rating.Good);
    const policy = { dayStart: new Date("2026-10-09T04:00:00Z"), maxNewCards: 1 };
    const answers = await Promise.allSettled([1, 2].map((id) =>
      client.runDatabaseTransaction((tx) => saveReview(tx, id, result, policy)),
    ));
    assert.equal(answers.filter((answer) => answer.status === "fulfilled").length, 1);
    const failure = answers.find((answer) => answer.status === "rejected");
    assert.ok(failure?.status === "rejected");
    assert.match(String(failure.reason), /лимит/);
    assert.equal(countRows(fixture, "user_card_meaning"), 1);
    assert.equal(countRows(fixture, "user_card_meaning_review"), 1);
  } finally {
    fixture.close();
  }
});

test("review persistence keeps the progress identity and original FSRS logs, rejecting stale answers", async () => {
  const fixture = createContentDatabase();
  try {
    await migrateUserData(fixture.database);
    fixture.raw.exec("INSERT INTO user_deck(deck_id) VALUES(1)");
    const client = createSQLiteClient(() => fixture.database);
    const scheduler = fsrs({ enable_fuzz: false });
    const now = new Date("2026-10-09T12:00:00Z");
    const first = scheduler.next(createEmptyCard(now), now, Rating.Good);
    const progress = await client.runDatabaseTransaction((tx) =>
      saveReview(tx, 1, first),
    );
    await assert.rejects(
      client.runDatabaseTransaction((tx) => saveReview(tx, 1, first)),
      /уже изменилась/,
    );
    const second = scheduler.next(first.card, first.card.due, Rating.Good);
    const nextProgress = await client.runDatabaseTransaction((tx) =>
      saveReview(tx, 1, second),
    );
    assert.equal(nextProgress.id, progress.id);
    assert.equal(nextProgress.reps, 2);
    assert.equal(nextProgress.lastReview?.getTime(), second.log.review.getTime());
    const history = fixture.raw.prepare(
      "SELECT * FROM user_card_meaning_review ORDER BY id",
    ).all();
    assert.equal(history.length, 2);
    assert.equal(history[0].state, State.New);
    assert.equal(history[1].due, second.log.due.getTime());
    assert.equal(history[1].stability, second.log.stability);
    assert.equal(history[1].learning_steps, second.log.learning_steps);
    assert.equal(
      fixture.raw.prepare("SELECT last_reviewed_at FROM user_deck").get()?.last_reviewed_at,
      second.log.review.getTime(),
    );
  } finally {
    fixture.close();
  }
});

test("a failed history write rolls back progress and can be retried", async () => {
  const fixture = createContentDatabase();
  try {
    await migrateUserData(fixture.database);
    fixture.raw.exec(`
      INSERT INTO user_deck(deck_id) VALUES(1);
      CREATE TRIGGER fail_history BEFORE INSERT ON user_card_meaning_review
      BEGIN SELECT RAISE(ABORT, 'history write failed'); END;
    `);
    const client = createSQLiteClient(() => fixture.database);
    const now = new Date("2026-10-09T12:00:00Z");
    const result = fsrs({ enable_fuzz: false }).next(
      createEmptyCard(now), now, Rating.Good,
    );
    await assert.rejects(
      client.runDatabaseTransaction((tx) => saveReview(tx, 1, result)),
    );
    assert.equal(countRows(fixture, "user_card_meaning"), 0);
    assert.equal(fixture.raw.prepare("SELECT last_reviewed_at FROM user_deck").get()?.last_reviewed_at, null);
    fixture.raw.exec("DROP TRIGGER fail_history");
    await client.runDatabaseTransaction((tx) => saveReview(tx, 1, result));
    assert.equal(countRows(fixture, "user_card_meaning_review"), 1);
  } finally {
    fixture.close();
  }
});
