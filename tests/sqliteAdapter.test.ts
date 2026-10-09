import assert from "node:assert/strict";
import { test } from "node:test";
import { sql } from "drizzle-orm";
import { createSQLiteClient } from "../src/config/sqliteAdapter";
import { createTestDatabase } from "./helpers/sqlite";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

test("outside queries cannot read or join an unfinished transaction", async () => {
  const fixture = createTestDatabase("CREATE TABLE item (id INTEGER PRIMARY KEY)");
  const { db, runDatabaseTransaction } = createSQLiteClient(() => fixture.database);
  const started = deferred();
  const resume = deferred();
  try {
    const transaction = runDatabaseTransaction(async (tx) => {
      await tx.run(sql`INSERT INTO item VALUES (1)`);
      started.resolve();
      await resume.promise;
      throw new Error("cancel");
    });
    await started.promise;
    let readFinished = false;
    const outsideRead = db.all(sql`SELECT id FROM item`).then((rows) => {
      readFinished = true;
      return rows;
    });
    await Promise.resolve();
    assert.equal(readFinished, false);
    resume.resolve();
    await assert.rejects(transaction, /cancel/);
    assert.deepEqual(await outsideRead, []);
    await db.run(sql`INSERT INTO item VALUES (2)`);
    assert.deepEqual(await db.all(sql`SELECT id FROM item`), [[2]]);
  } finally {
    fixture.close();
  }
});

test("concurrent transactions are serialized and return their own results", async () => {
  const fixture = createTestDatabase("CREATE TABLE item (id INTEGER PRIMARY KEY)");
  const { db, runDatabaseTransaction } = createSQLiteClient(() => fixture.database);
  try {
    const values = await Promise.all([1, 2, 3].map((id) => runDatabaseTransaction(async (tx) => {
      await tx.run(sql`INSERT INTO item VALUES (${id})`);
      return id;
    })));
    assert.deepEqual(values, [1, 2, 3]);
    assert.deepEqual(await db.all(sql`SELECT id FROM item ORDER BY id`), [[1], [2], [3]]);
  } finally {
    fixture.close();
  }
});

test("a failed statement is finalized and does not block later queries", async () => {
  const fixture = createTestDatabase("CREATE TABLE item (id INTEGER PRIMARY KEY)");
  const prepare = fixture.database.prepareAsync.bind(fixture.database);
  let finalized = false;
  fixture.database.prepareAsync = async (query) => {
    const statement = await prepare(query);
    const finalize = statement.finalizeAsync.bind(statement);
    statement.finalizeAsync = async () => { finalized = true; await finalize(); };
    return statement;
  };
  const { db } = createSQLiteClient(() => fixture.database);
  try {
    await db.run(sql`INSERT INTO item VALUES (1)`);
    await assert.rejects(db.all(sql`INSERT INTO item VALUES (1) RETURNING id`));
    assert.equal(finalized, true);
    assert.deepEqual(await db.all(sql`SELECT id FROM item`), [[1]]);
  } finally {
    fixture.close();
  }
});

test("standard and nested Drizzle transactions keep savepoint rollback isolated", async () => {
  const fixture = createTestDatabase("CREATE TABLE item (id INTEGER PRIMARY KEY)");
  const { db } = createSQLiteClient(() => fixture.database);
  try {
    await Promise.all([
      db.transaction(async (tx) => {
        await tx.run(sql`INSERT INTO item VALUES (1)`);
        await assert.rejects(tx.transaction(async (nested) => {
          await nested.run(sql`INSERT INTO item VALUES (2)`);
          throw new Error("cancel nested");
        }), /cancel nested/);
        await tx.run(sql`INSERT INTO item VALUES (3)`);
      }),
      db.transaction(async (tx) => { await tx.run(sql`INSERT INTO item VALUES (4)`); }),
    ]);
    assert.deepEqual(await db.all(sql`SELECT id FROM item ORDER BY id`), [[1], [3], [4]]);
  } finally {
    fixture.close();
  }
});
