import {
  getCardExamples,
  getDeckSummaries,
} from "@/db/repositories/cardRepository";
import { addUserDeck } from "@/db/repositories/userRepository";
import { answerStudyCard, getStudyQueue } from "@/lib/study";
import { createAppStore } from "@/lib/appStore";

export const useAppStore = createAppStore({
  getCardExamples,
  getDeckSummaries,
  addUserDeck,
  getStudyQueue,
  answerStudyCard,
});
