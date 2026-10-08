import { create } from "zustand";
import { createEmptyCard, type Grade } from "ts-fsrs";
import {
  getDecks,
  getDeckWords,
  initializeDatabase,
  saveProgress,
  type DeckSummary,
  type StudyWord,
} from "@/db/database";
import { scheduler } from "@/lib/scheduler";

type AppState = {
  ready: boolean;
  now: number;
  error: string;
  decks: DeckSummary[];
  queue: StudyWord[];
  sessionId: string | null;
  sessionTotal: number;
  answered: number;
  revealed: boolean;
  saving: boolean;
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  startSession: (deckId: string) => Promise<void>;
  reveal: () => void;
  answer: (rating: Grade) => Promise<void>;
};

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  now: 0,
  error: "",
  decks: [],
  queue: [],
  sessionId: null,
  sessionTotal: 0,
  answered: 0,
  revealed: false,
  saving: false,

  initialize: async () => {
    set({ error: "" });
    try {
      await initializeDatabase();
      set({ decks: await getDecks(), ready: true, now: Date.now() });
    } catch (error) {
      console.error(error);
      set({ error: "Не удалось открыть локальную базу. Попробуйте ещё раз." });
    }
  },

  refresh: async () => set({ decks: await getDecks(), now: Date.now() }),

  startSession: async (deckId) => {
    const words = await getDeckWords(deckId === "all" ? undefined : deckId);
    const queue = words
      .filter((word) => word.due <= Date.now())
      // Сначала повторения, затем новые слова в порядке колоды.
      .sort((a, b) => Number(!a.card) - Number(!b.card) || a.due - b.due);
    set({
      queue,
      sessionId: deckId,
      sessionTotal: queue.length,
      answered: 0,
      revealed: false,
      now: Date.now(),
    });
  },

  reveal: () => set({ revealed: true }),

  answer: async (rating) => {
    const { queue, revealed, answered, saving } = get();
    const word = queue[0];
    if (!word || !revealed || saving) return;

    const result = scheduler.next(
      word.card ?? createEmptyCard(),
      new Date(),
      rating,
    );
    // Сначала сохраняем, только потом показываем следующую карточку.
    set({ saving: true });
    try {
      await saveProgress(word.id, result.card);
      set({
        queue: queue.slice(1),
        answered: answered + 1,
        revealed: false,
        now: Date.now(),
      });
    } finally {
      set({ saving: false });
    }
    await get().refresh().catch(console.error);
  },
}));
