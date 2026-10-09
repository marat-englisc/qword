import { create } from "zustand";
import type { Grade } from "ts-fsrs";
import type {
  getCardExamples,
  getDeckSummaries,
  DeckSummary,
} from "@/db/repositories/cardRepository";
import type { addUserDeck, removeUserDeck } from "@/db/repositories/userRepository";
import type { getSettings, saveAppearance, saveSettings } from "@/db/repositories/settingsRepository";
import { defaultSettings, type Appearance, type StudySettings } from "./settings";
import type { answerStudyCard, getStudyQueue, StudyItem } from "@/lib/study";
import { StudyCardUnavailableError } from "./studyErrors";

type StudyQueue = Awaited<ReturnType<typeof getStudyQueue>>;
type CardExample = Awaited<ReturnType<typeof getCardExamples>>[number];

type AppState = {
  ready: boolean;
  now: number;
  error: string;
  decks: DeckSummary[];
  overview: StudyQueue | null;
  session: StudyQueue | null;
  currentCard: StudyItem | null;
  examples: CardExample[];
  sessionId: string | null;
  answered: number;
  revealed: boolean;
  saving: boolean;
  settings: StudySettings;
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  addDeck: (deckId: number) => Promise<void>;
  removeDeck: (deckId: number) => Promise<void>;
  updateSettings: (settings: StudySettings) => Promise<void>;
  setAppearance: (appearance: Appearance) => Promise<void>;
  startSession: (sessionId: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  reveal: () => void;
  answer: (rating: Grade) => Promise<void>;
};

type AppDependencies = {
  getCardExamples: typeof getCardExamples;
  getDeckSummaries: typeof getDeckSummaries;
  addUserDeck: typeof addUserDeck;
  removeUserDeck: typeof removeUserDeck;
  getSettings: typeof getSettings;
  saveSettings: typeof saveSettings;
  saveAppearance: typeof saveAppearance;
  getStudyQueue: typeof getStudyQueue;
  answerStudyCard: typeof answerStudyCard;
};

export function createAppStore(dependencies: AppDependencies) {
  let sessionVersion = 0;
  let overviewVersion = 0;
  let appearanceVersion = 0;
  let initializing: Promise<void> | null = null;
  let savingAnswer: ReturnType<typeof answerStudyCard> | null = null;
  let settingsWrite: Promise<void> = Promise.resolve();
  let refreshingSession: { version: number; promise: Promise<void> } | null =
    null;

  async function loadSession(sessionId: string) {
    const session = await dependencies.getStudyQueue({
      deckId: sessionId === "all" ? undefined : Number(sessionId),
    });
    const currentCard = session.queue[0] ?? null;
    const examples = currentCard
      ? await dependencies.getCardExamples(currentCard.meaning.id)
      : [];
    return { session, currentCard, examples, now: Date.now() };
  }

  return create<AppState>((set, get) => ({
    ready: false,
    now: Date.now(),
    error: "",
    decks: [],
    overview: null,
    session: null,
    currentCard: null,
    examples: [],
    sessionId: null,
    answered: 0,
    revealed: false,
    saving: false,
    settings: defaultSettings,

    initialize: () => {
      if (initializing) return initializing;
      set({ error: "" });
      initializing = get()
        .refresh()
        .catch((error: unknown) => {
          const cause =
            error instanceof Error && "cause" in error ? error.cause : error;
          console.error("Не удалось прочитать SQLite:", cause);
          if (!get().ready)
            set({
              error: "Не удалось прочитать локальную базу. Попробуйте ещё раз.",
            });
        })
        .finally(() => {
          initializing = null;
        });
      return initializing;
    },

    refresh: async () => {
      const version = ++overviewVersion;
      const appearanceAtStart = appearanceVersion;
      const now = new Date();
      const [decks, overview, settings] = await Promise.all([
        dependencies.getDeckSummaries(now),
        dependencies.getStudyQueue({}, now),
        dependencies.getSettings(),
      ]);
      if (version === overviewVersion)
        set({ decks, overview,
          settings: appearanceAtStart === appearanceVersion ? settings : { ...settings, appearance: get().settings.appearance },
          ready: true, error: "", now: now.getTime() });
    },

    addDeck: async (deckId) => {
      ++overviewVersion;
      await dependencies.addUserDeck(deckId);
      await get().refresh();
    },

    removeDeck: async (deckId) => {
      if (savingAnswer) await savingAnswer.catch(() => undefined);
      await dependencies.removeUserDeck(deckId);
      ++sessionVersion;
      ++overviewVersion;
      set({ decks: get().decks.map((deck) => deck.id === deckId ? { ...deck, added: false } : deck),
        currentCard: null, session: null, examples: [], revealed: false, overview: null });
      await get().refresh().catch(console.error);
    },

    updateSettings: async (settings) => {
      if (savingAnswer) await savingAnswer.catch(() => undefined);
      const write = settingsWrite.catch(() => undefined).then(async () => {
        const saved = await dependencies.saveSettings({ ...settings, appearance: get().settings.appearance });
        ++sessionVersion;
        ++overviewVersion;
        set({ settings: saved, currentCard: null, session: null, examples: [], revealed: false, overview: null });
        await get().refresh().catch(console.error);
      });
      settingsWrite = write;
      await write;
    },

    setAppearance: (appearance) => {
      const write = settingsWrite.catch(() => undefined).then(async () => {
        const saved = await dependencies.saveAppearance(appearance);
        ++appearanceVersion;
        set({ settings: saved });
      });
      settingsWrite = write;
      return write;
    },

    startSession: async (sessionId) => {
      if (
        sessionId !== "all" &&
        (!/^[1-9]\d*$/.test(sessionId) ||
          !Number.isSafeInteger(Number(sessionId)) ||
          !get().decks.some(
            (deck) => deck.id === Number(sessionId) && deck.added,
          ))
      )
        throw new Error("Сначала добавьте колоду к изучению.");

      const version = ++sessionVersion;
      set({
        sessionId,
        currentCard: null,
        examples: [],
        session: null,
        revealed: false,
        answered: 0,
      });
      // Очередь новой сессии должна увидеть уже записанный ответ старой.
      if (savingAnswer) await savingAnswer.catch(() => undefined);
      if (version !== sessionVersion) return;
      const loaded = await loadSession(sessionId);
      if (version === sessionVersion) set(loaded);
    },

    // Открытую карточку таймер не меняет. Параллельные тики ждут одну загрузку.
    refreshSession: () => {
      const { sessionId, currentCard, saving } = get();
      if (!sessionId || currentCard || saving) return Promise.resolve();
      const version = sessionVersion;
      if (refreshingSession?.version === version)
        return refreshingSession.promise;

      const promise = loadSession(sessionId)
        .then((loaded) => {
          if (version === sessionVersion && !get().saving && !get().currentCard)
            set({ ...loaded, revealed: false });
        })
        .finally(() => {
          if (refreshingSession?.promise === promise) refreshingSession = null;
        });
      refreshingSession = { version, promise };
      return promise;
    },

    reveal: () => {
      if (get().currentCard && !get().saving)
        set({ revealed: true, now: Date.now() });
    },

    answer: async (rating) => {
      const { currentCard, revealed, saving, sessionId } = get();
      if (!currentCard || !revealed || saving || !sessionId) return;

      const version = ++sessionVersion;
      ++overviewVersion;
      let committed = false;
      let invalidated = false;
      set({ saving: true });
      try {
        savingAnswer = dependencies.answerStudyCard(
          currentCard.meaning.id,
          rating,
        );
        await savingAnswer;
        committed = true;
        if (version === sessionVersion) {
          // Сохранённый ответ нельзя отправить повторно, даже если загрузка упала.
          set({
            currentCard: null,
            examples: [],
            revealed: false,
            answered: get().answered + 1,
          });
          const loaded = await loadSession(sessionId);
          if (version === sessionVersion) set(loaded);
        }
      } catch (error) {
        if (error instanceof StudyCardUnavailableError) {
          invalidated = true;
          if (version === sessionVersion) {
            set({ currentCard: null, examples: [], revealed: false });
            const loaded = await loadSession(sessionId);
            if (version === sessionVersion) set(loaded);
          }
        }
        throw error;
      } finally {
        savingAnswer = null;
        set({ saving: false });
        if (committed || invalidated)
          await get().refresh().catch(console.error);
      }
    },
  }));
}
