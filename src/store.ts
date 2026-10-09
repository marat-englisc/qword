import {
  getCardExamples,
  getDeckSummaries,
} from "@/db/repositories/cardRepository";
import { addUserDeck, removeUserDeck } from "@/db/repositories/userRepository";
import { getSettings, saveAppearance, saveSettings } from "@/db/repositories/settingsRepository";
import { answerStudyCard, getStudyQueue } from "@/lib/study";
import { createAppStore } from "@/lib/appStore";

export const useAppStore = createAppStore({
  getCardExamples,
  getDeckSummaries,
  addUserDeck,
  removeUserDeck,
  getSettings,
  saveSettings,
  saveAppearance,
  getStudyQueue,
  answerStudyCard,
});
