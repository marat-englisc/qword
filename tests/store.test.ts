import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyCard, Rating } from "ts-fsrs";
import { createAppStore } from "../src/lib/appStore";
import { scheduler } from "../src/lib/scheduler";
import { StudyCardUnavailableError } from "../src/lib/studyErrors";
import { buildStudyQueue, planStudyQueue } from "../src/lib/studyQueue";
import { studyCard, studyNow } from "./studyFixtures";
import { defaultSettings } from "../src/lib/settings";

type Dependencies = Parameters<typeof createAppStore>[0];
type StudyQueue = Awaited<ReturnType<Dependencies["getStudyQueue"]>>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function queue(id?: number): StudyQueue {
  return buildStudyQueue(planStudyQueue([], [], {}, studyNow), id === undefined ? [] : [studyCard(id)]);
}

function deck(id: number) {
  return {
    id,
    name: `Deck ${id}`,
    added: true,
    wordCount: 10,
    meaningCount: 10,
    studiedMeaningCount: 0,
    newMeaningCount: 10,
    reviewCount: 0,
    nextDue: null,
  };
}

function setup(overrides: Partial<Dependencies> = {}) {
  const dependencies: Dependencies = {
    getDeckSummaries: async () => [deck(1), deck(2)],
    getStudyQueue: async () => queue(),
    getCardExamples: async () => [],
    addUserDeck: async (deckId) => ({ id: deckId, deckId, createdAt: "2026-10-09", lastReviewedAt: null }),
    removeUserDeck: async () => {},
    getSettings: async () => defaultSettings,
    saveSettings: async (settings) => settings,
    saveAppearance: async (appearance) => ({ ...defaultSettings, appearance }),
    answerStudyCard: async () => scheduler.next(createEmptyCard(studyNow), studyNow, Rating.Good),
    ...overrides,
  };
  const store = createAppStore(dependencies);
  store.setState({ decks: [deck(1), deck(2)] });
  return store;
}

test("old session loads cannot replace a newer session even after A → B → A", async () => {
  const pending = [deferred<StudyQueue>(), deferred<StudyQueue>(), deferred<StudyQueue>()];
  let index = 0;
  const store = setup({ getStudyQueue: async () => pending[index++].promise });
  const firstA = store.getState().startSession("1");
  const b = store.getState().startSession("2");
  const secondA = store.getState().startSession("1");
  pending[2].resolve(queue(3));
  await secondA;
  pending[1].resolve(queue(2));
  pending[0].resolve(queue(1));
  await Promise.all([firstA, b]);
  assert.equal(store.getState().sessionId, "1");
  assert.equal(store.getState().currentCard?.meaning.id, 3);
});

test("changing the session immediately clears examples from the previous meaning", async () => {
  const pending = deferred<StudyQueue>();
  let calls = 0;
  const store = setup({
    getStudyQueue: async () => ++calls === 1 ? queue(1) : pending.promise,
    getCardExamples: async (cardMeaningId) => [{ id: 1, cardMeaningId, example: "old example", exampleTranslation: "старый пример" }],
  });
  await store.getState().startSession("1");
  assert.equal(store.getState().examples.length, 1);
  const next = store.getState().startSession("2");
  assert.deepEqual(store.getState().examples, []);
  assert.equal(store.getState().currentCard, null);
  pending.resolve(queue());
  await next;
});

test("empty-session timer refreshes share one request and cannot overwrite a fresh session", async () => {
  const pending = deferred<StudyQueue>();
  let calls = 0;
  const store = setup({
    getStudyQueue: async () => {
      calls++;
      if (calls === 1) return queue();
      if (calls === 2) return pending.promise;
      return queue(2);
    },
  });
  await store.getState().startSession("1");
  const first = store.getState().refreshSession();
  const second = store.getState().refreshSession();
  assert.equal(first, second);
  assert.equal(calls, 2);
  await store.getState().startSession("1");
  pending.resolve(queue(1));
  await first;
  assert.equal(store.getState().currentCard?.meaning.id, 2);
});

test("late overview requests cannot revert newer counters and decks", async () => {
  const firstDecks = deferred<ReturnType<typeof deck>[]>();
  const secondDecks = deferred<ReturnType<typeof deck>[]>();
  const firstQueue = deferred<StudyQueue>();
  const secondQueue = deferred<StudyQueue>();
  let deckCalls = 0;
  let queueCalls = 0;
  const store = setup({
    getDeckSummaries: async () => ++deckCalls === 1 ? firstDecks.promise : secondDecks.promise,
    getStudyQueue: async () => ++queueCalls === 1 ? firstQueue.promise : secondQueue.promise,
  });
  const first = store.getState().refresh();
  const second = store.getState().refresh();
  secondDecks.resolve([deck(2)]);
  secondQueue.resolve(queue(2));
  await second;
  firstDecks.resolve([deck(1)]);
  firstQueue.resolve(queue(1));
  await first;
  assert.deepEqual(store.getState().decks.map((item) => item.id), [2]);
  assert.equal(store.getState().overview?.queue[0].meaning.id, 2);
});

test("a failed save keeps the revealed card available for a deliberate retry", async () => {
  let saves = 0;
  const store = setup({
    getStudyQueue: async () => queue(1),
    answerStudyCard: async () => {
      saves++;
      if (saves === 1) throw new Error("database unavailable");
      return scheduler.next(createEmptyCard(studyNow), studyNow, Rating.Good);
    },
  });
  await store.getState().startSession("1");
  store.getState().reveal();
  await assert.rejects(store.getState().answer(Rating.Good), /database unavailable/);
  assert.equal(store.getState().currentCard?.meaning.id, 1);
  assert.equal(store.getState().revealed, true);
  assert.equal(store.getState().answered, 0);
  assert.equal(store.getState().saving, false);
  await store.getState().answer(Rating.Good);
  assert.equal(saves, 2);
  assert.equal(store.getState().answered, 1);
});

test("a saved answer survives a failed next-card load and is never submitted twice", async () => {
  let queueCalls = 0;
  let saves = 0;
  let overviewRefreshes = 0;
  const store = setup({
    getStudyQueue: async () => {
      queueCalls++;
      if (queueCalls === 1) return queue(1);
      if (queueCalls === 2) throw new Error("next card unavailable");
      return queueCalls === 3 ? queue() : queue(2);
    },
    getDeckSummaries: async () => {
      overviewRefreshes++;
      return [deck(1)];
    },
    answerStudyCard: async () => {
      saves++;
      return scheduler.next(createEmptyCard(studyNow), studyNow, Rating.Good);
    },
  });
  await store.getState().startSession("1");
  store.getState().reveal();
  await assert.rejects(store.getState().answer(Rating.Good), /next card unavailable/);
  assert.equal(store.getState().answered, 1);
  assert.equal(store.getState().currentCard, null);
  assert.equal(store.getState().revealed, false);
  assert.equal(store.getState().saving, false);
  assert.equal(overviewRefreshes, 1);
  await store.getState().answer(Rating.Good);
  assert.equal(saves, 1);
  await store.getState().refreshSession();
  assert.equal(store.getState().currentCard?.meaning.id, 2);
});

test("an unavailable card refreshes the queue without counting a rejected answer", async () => {
  let calls = 0;
  const store = setup({
    getStudyQueue: async () => ++calls === 1 ? queue(1) : queue(2),
    answerStudyCard: async () => { throw new StudyCardUnavailableError("card already reviewed"); },
  });
  await store.getState().startSession("1");
  store.getState().reveal();
  await assert.rejects(store.getState().answer(Rating.Good), /card already reviewed/);
  assert.equal(store.getState().currentCard?.meaning.id, 2);
  assert.equal(store.getState().answered, 0);
  assert.equal(store.getState().revealed, false);
  assert.equal(store.getState().saving, false);
});

test("a failed recovery leaves no stale card and can retry loading without another answer", async () => {
  let calls = 0;
  let answers = 0;
  const store = setup({
    getStudyQueue: async () => {
      calls++;
      if (calls === 1) return queue(1);
      if (calls === 2) throw new Error("recovery failed");
      return queue(2);
    },
    answerStudyCard: async () => {
      answers++;
      throw new StudyCardUnavailableError("card changed");
    },
  });
  await store.getState().startSession("1");
  store.getState().reveal();
  await assert.rejects(store.getState().answer(Rating.Good), /recovery failed/);
  assert.equal(store.getState().currentCard, null);
  assert.equal(store.getState().answered, 0);
  assert.equal(store.getState().saving, false);
  await store.getState().refreshSession();
  assert.equal(store.getState().currentCard?.meaning.id, 2);
  assert.equal(answers, 1);
});

test("double-tapping a rating commits once", async () => {
  const pending = deferred<Awaited<ReturnType<Dependencies["answerStudyCard"]>>>();
  let saves = 0;
  const store = setup({
    getStudyQueue: async () => queue(1),
    answerStudyCard: async () => {
      saves++;
      return pending.promise;
    },
  });
  await store.getState().startSession("1");
  store.getState().reveal();
  const first = store.getState().answer(Rating.Good);
  await store.getState().answer(Rating.Easy);
  assert.equal(saves, 1);
  pending.resolve(scheduler.next(createEmptyCard(studyNow), studyNow, Rating.Good));
  await first;
  assert.equal(store.getState().answered, 1);
});

test("finishing an old save cannot replace the card or counters of a new session", async () => {
  const pending = deferred<Awaited<ReturnType<Dependencies["answerStudyCard"]>>>();
  let sessionLoads = 0;
  const store = setup({
    getStudyQueue: async (options) => {
      if (options?.deckId !== undefined) sessionLoads++;
      return queue(options?.deckId);
    },
    answerStudyCard: async () => pending.promise,
  });
  await store.getState().startSession("1");
  store.getState().reveal();
  const answer = store.getState().answer(Rating.Good);
  const nextSession = store.getState().startSession("2");
  assert.equal(store.getState().currentCard, null);
  assert.equal(sessionLoads, 1);
  pending.resolve(scheduler.next(createEmptyCard(studyNow), studyNow, Rating.Good));
  await Promise.all([answer, nextSession]);
  assert.equal(sessionLoads, 2);
  assert.equal(store.getState().sessionId, "2");
  assert.equal(store.getState().currentCard?.meaning.id, 2);
  assert.equal(store.getState().answered, 0);
  assert.equal(store.getState().revealed, false);
});

test("concurrent initialization shares one load and becomes ready only after it completes", async () => {
  const pending = deferred<StudyQueue>();
  let calls = 0;
  const store = setup({ getStudyQueue: async () => { calls++; return pending.promise; } });
  const first = store.getState().initialize();
  const second = store.getState().initialize();
  assert.equal(first, second);
  assert.equal(calls, 1);
  assert.equal(store.getState().ready, false);
  pending.resolve(queue());
  await first;
  assert.equal(store.getState().ready, true);
});

test("invalid or unadded deck sessions are rejected without altering the active card", async () => {
  const store = setup({ getStudyQueue: async () => queue(1) });
  await store.getState().startSession("1");
  for (const id of ["3", "0", "-1", "1.0", "1e0", "Infinity"])
    await assert.rejects(store.getState().startSession(id));
  assert.equal(store.getState().sessionId, "1");
  assert.equal(store.getState().currentCard?.meaning.id, 1);
});

test("unsubscribing invalidates pending session loads and immediately marks the deck inactive", async () => {
  const pending = deferred<StudyQueue>();
  let subscribed = true;
  const store = setup({
    getStudyQueue: async (options) => options?.deckId ? pending.promise : queue(),
    getDeckSummaries: async () => [{ ...deck(1), added: subscribed }],
    removeUserDeck: async () => { subscribed = false; },
  });
  const session = store.getState().startSession("1");
  await store.getState().removeDeck(1);
  pending.resolve(queue(1));
  await session;
  assert.equal(store.getState().currentCard, null);
  assert.equal(store.getState().decks[0].added, false);
  await assert.rejects(store.getState().startSession("1"));
});

test("failed unsubscribe leaves the active session and subscription intact", async () => {
  const store = setup({ getStudyQueue: async () => queue(1), removeUserDeck: async () => { throw new Error("write failed"); } });
  await store.getState().startSession("1");
  await assert.rejects(store.getState().removeDeck(1), /write failed/);
  assert.equal(store.getState().currentCard?.meaning.id, 1);
  assert.equal(store.getState().decks[0].added, true);
});

test("saving settings clears an old FSRS preview; failed persistence keeps the original settings", async () => {
  let saved = defaultSettings;
  const store = setup({
    getStudyQueue: async () => queue(1), getSettings: async () => saved,
    saveSettings: async (settings) => { saved = settings; return settings; },
  });
  await store.getState().startSession("1");
  store.getState().reveal();
  const next = { ...defaultSettings, requestRetention: 0.95 };
  await store.getState().updateSettings(next);
  assert.deepEqual(store.getState().settings, next);
  assert.equal(store.getState().currentCard, null);
  assert.equal(store.getState().revealed, false);
  const failing = setup({ saveSettings: async () => { throw new Error("write failed"); } });
  await assert.rejects(failing.getState().updateSettings(next), /write failed/);
  assert.deepEqual(failing.getState().settings, defaultSettings);
});

test("changing appearance preserves the open card, answer reveal and active session", async () => {
  const store = setup({ getStudyQueue: async () => queue(1) });
  await store.getState().startSession("1");
  store.getState().reveal();
  store.setState({ answered: 3 });
  const before = store.getState();
  await store.getState().setAppearance("dark");
  const after = store.getState();
  assert.equal(after.settings.appearance, "dark");
  assert.equal(after.session, before.session);
  assert.equal(after.currentCard, before.currentCard);
  assert.equal(after.examples, before.examples);
  assert.equal(after.sessionId, "1");
  assert.equal(after.revealed, true);
  assert.equal(after.answered, 3);
});

test("appearance and algorithm writes are serialized and a stale draft cannot restore the old theme", async () => {
  let persisted = { ...defaultSettings };
  const appearanceWrite = deferred<typeof defaultSettings>();
  let algorithmWriteStarted = false;
  const store = setup({
    getSettings: async () => persisted,
    saveAppearance: async (appearance) => {
      await appearanceWrite.promise;
      persisted = { ...persisted, appearance };
      return persisted;
    },
    saveSettings: async (settings) => {
      algorithmWriteStarted = true;
      persisted = settings;
      return persisted;
    },
  });
  const changeTheme = store.getState().setAppearance("dark");
  const saveDraft = store.getState().updateSettings({ ...defaultSettings, newCardsPerDay: 17 });
  await Promise.resolve();
  assert.equal(algorithmWriteStarted, false);
  appearanceWrite.resolve(defaultSettings);
  await Promise.all([changeTheme, saveDraft]);
  assert.equal(persisted.appearance, "dark");
  assert.equal(persisted.newCardsPerDay, 17);
  assert.deepEqual(store.getState().settings, persisted);
});

test("failed appearance write keeps the theme and does not block a retry", async () => {
  let fails = true;
  const store = setup({ saveAppearance: async (appearance) => {
    if (fails) throw new Error("write failed");
    return { ...defaultSettings, appearance };
  } });
  await assert.rejects(store.getState().setAppearance("dark"), /write failed/);
  assert.equal(store.getState().settings.appearance, "light");
  fails = false;
  await store.getState().setAppearance("dark");
  assert.equal(store.getState().settings.appearance, "dark");
});

test("an older overview read cannot revert a newly saved appearance", async () => {
  const oldSettings = deferred<typeof defaultSettings>();
  const store = setup({ getSettings: async () => oldSettings.promise });
  const refresh = store.getState().refresh();
  await store.getState().setAppearance("dark");
  oldSettings.resolve(defaultSettings);
  await refresh;
  assert.equal(store.getState().settings.appearance, "dark");
  assert.equal(store.getState().ready, true);
  assert.deepEqual(store.getState().overview, queue());
});
