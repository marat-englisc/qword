import { create } from "zustand";
import type { Grade } from "ts-fsrs";
import {
  getCardExamples,
  getDeckSummaries,
  type DeckSummary,
} from "@/db/repositories/cardRepository";
import { addUserDeck } from "@/db/repositories/userRepository";
import { answerStudyCard, getStudyQueue, type StudyItem } from "@/lib/study";

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
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  addDeck: (deckId: number) => Promise<void>;
  startSession: (sessionId: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  reveal: () => void;
  answer: (rating: Grade) => Promise<void>;
};

async function loadSession(sessionId: string) {
  const session = await getStudyQueue({
    deckId: sessionId === "all" ? undefined : Number(sessionId),
  });
  const currentCard = session.queue[0] ?? null;
  const examples = currentCard
    ? await getCardExamples(currentCard.meaning.id)
    : [];
  return { session, currentCard, examples, now: Date.now() };
}

export const useAppStore = create<AppState>((set, get) => ({
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

  initialize: async () => {
    set({ error: "" });
    try {
      await get().refresh();
      set({ ready: true });
    } catch (error) {
      const cause = error instanceof Error && "cause" in error ? error.cause : error;
      console.error("Не удалось прочитать SQLite:", cause);
      set({ error: "Не удалось прочитать локальную базу. Попробуйте ещё раз." });
    }
  },

  refresh: async () => {
    const [decks, overview] = await Promise.all([
      getDeckSummaries(),
      getStudyQueue(),
    ]);
    set({ decks, overview, now: Date.now() });
  },

  addDeck: async (deckId) => {
    await addUserDeck(deckId);
    await get().refresh();
  },

  startSession: async (sessionId) => {
    if (get().saving) return;
    if (
      sessionId !== "all" &&
      !get().decks.some((deck) => deck.id === Number(sessionId) && deck.added)
    )
      throw new Error("Сначала добавьте колоду к изучению.");

    set({
      sessionId,
      currentCard: null,
      session: null,
      revealed: false,
      answered: 0,
    });
    const loaded = await loadSession(sessionId);
    if (get().sessionId === sessionId) set(loaded);
  },

  // Когда очередь пуста, ждём срока FSRS. Открытую карточку таймер не меняет.
  refreshSession: async () => {
    const { sessionId, currentCard, saving } = get();
    if (!sessionId || currentCard || saving) return;
    const loaded = await loadSession(sessionId);
    if (get().sessionId === sessionId && !get().saving && !get().currentCard)
      set({ ...loaded, revealed: false });
  },

  reveal: () => set({ revealed: true, now: Date.now() }),

  answer: async (rating) => {
    const { currentCard, revealed, saving, sessionId } = get();
    if (!currentCard || !revealed || saving || !sessionId) return;

    set({ saving: true });
    try {
      // Оценка относится к meaning.id. Соседние значения слова не меняются.
      await answerStudyCard(currentCard.meaning.id, rating);
      set({
        currentCard: null,
        examples: [],
        revealed: false,
        answered: get().answered + 1,
      });
      const loaded = await loadSession(sessionId);
      if (get().sessionId === sessionId) set(loaded);
    } finally {
      set({ saving: false });
    }
    await get().refresh().catch(console.error);
  },
}));
