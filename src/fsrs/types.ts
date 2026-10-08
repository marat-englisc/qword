import type { FSRSParameters, Grade } from "ts-fsrs";
import type { cardTable } from "../../db/schemas/card/card";
import type { cardMeaningTable } from "../../db/schemas/card/cardMeaning";
import type { deckTable } from "../../db/schemas/card/deck";
import type { UserCardMeaning } from "../../db/repositories/user/userCardMeaningRepository";
import type {
  NewReviewLog,
  ReviewProgress,
  UserCardMeaningReview,
} from "../../db/repositories/user/userCardMeaningReviewRepository";

export interface StudyPolicy {
  dailyNewLimit: number;
  dailyReviewLimit: number;
  newCardEvery: number;
  backlogSoftLimit: number;
  backlogHardLimit: number;
  siblingSpacing: number;
  queueLimit: number;
  timeZone: string;
}

export interface StudyCandidate {
  card: typeof cardTable.$inferSelect;
  meaning: typeof cardMeaningTable.$inferSelect;
  deck: typeof deckTable.$inferSelect;
  progress: UserCardMeaning | null;
}

export interface DailyActivity {
  introducedMeaningIds: number[];
  reviewedMeaningIds: number[];
  answers: number;
  reviewsSinceLastNew: number;
  lastIntroducedDeckId?: number | null;
  recentCardIds?: number[];
}

export interface StudyDay {
  key: string;
  start: Date;
  end: Date;
}

export interface StudySnapshot {
  userExists: boolean;
  activeDeckIds: number[];
  due: StudyCandidate[];
  newCards: StudyCandidate[];
  dueReviewCount: number;
  nextDueAt: Date | null;
  activity: DailyActivity;
}

export type StudyReason =
  | "learning"
  | "relearning"
  | "overdue"
  | "due_today"
  | "new";

export interface StudyPriority {
  score: number;
  retrievability: number | null;
  overdueDays: number;
  relativeOverdue: number;
}

export interface StudyItem extends StudyCandidate {
  version: string;
  reason: StudyReason;
  priority: StudyPriority;
}

export interface StudyQueueOptions {
  now?: Date;
  timeZone?: string;
  deckId?: number;
  limit?: number;
  recentCardIds?: readonly number[];
}

export interface StudyQueue {
  items: StudyItem[];
  generatedAt: Date;
  day: StudyDay;
  nextDueAt: Date | null;
  counts: {
    dueLearning: number;
    dueReview: number;
    globalDueReview: number;
    overdueReview: number;
    introducedToday: number;
    reviewedToday: number;
    answersToday: number;
    newRemaining: number;
    reviewRemaining: number;
  };
}

export interface ReviewRequest {
  cardMeaningId: number;
  version: string;
  rating: Grade;
  now?: Date;
  timeZone?: string;
}

export type PreviewRequest = Omit<ReviewRequest, "rating">;

export interface ReviewResult {
  progress: UserCardMeaning;
  review: UserCardMeaningReview;
}

export interface ReviewContext {
  candidate: StudyCandidate;
  activity: DailyActivity;
  dueReviewCount: number;
}

export interface ScheduledReview {
  progress: ReviewProgress;
  review: NewReviewLog;
}

export interface StudyRepository {
  loadSnapshot(
    userId: number,
    now: Date,
    day: StudyDay,
    deckId: number | undefined,
    newPerDeckLimit: number,
    preferences?: {
      siblingSpacing?: number;
      recentCardIds?: readonly number[];
    },
  ): StudySnapshot;
  getCandidate(userId: number, cardMeaningId: number): StudyCandidate | null;
  commitReview(
    userId: number,
    cardMeaningId: number,
    now: Date,
    day: StudyDay,
    apply: (context: ReviewContext) => ScheduledReview,
  ): ReviewResult;
}

export interface StudyServiceOptions {
  repository?: StudyRepository;
  fsrs?: Partial<FSRSParameters>;
  policy?: Partial<StudyPolicy>;
  clock?: () => Date;
}

export class StudyError extends Error {
  constructor(
    public readonly code:
      | "USER_NOT_FOUND"
      | "CARD_NOT_AVAILABLE"
      | "STALE_CARD"
      | "CARD_NOT_DUE"
      | "DAILY_LIMIT"
      | "INVALID_PROGRESS",
    message: string,
  ) {
    super(message);
    this.name = "StudyError";
  }
}
