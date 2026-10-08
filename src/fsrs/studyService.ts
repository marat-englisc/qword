import { State } from "ts-fsrs";
import { createStudyRepository } from "../../db/repositories/studyRepository";
import {
  createFsrsEngine,
  getProgressVersion,
  validateGrade,
  validateProgress,
} from "./engine";
import { resolveStudyPolicy } from "./policy";
import { buildStudyQueue, getStudyBudget } from "./queue";
import { getStudyDay, validateDate } from "./time";
import {
  StudyError,
  type PreviewRequest,
  type ReviewContext,
  type ReviewRequest,
  type StudyCandidate,
  type StudyItem,
  type StudyQueueOptions,
  type StudyServiceOptions,
} from "./types";

function validateId(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive safe integer`);
  }
}

export function createStudyService(options: StudyServiceOptions = {}) {
  const repository = options.repository ?? createStudyRepository();
  const engine = createFsrsEngine(options.fsrs);
  const policy = resolveStudyPolicy(options.policy);
  const clock = options.clock ?? (() => new Date());
  const getNow = (value?: Date) => {
    const now = value ?? clock();
    validateDate(now);
    return new Date(now);
  };
  const validateRequest = (userId: number, request: PreviewRequest) => {
    validateId(userId, "userId");
    validateId(request.cardMeaningId, "cardMeaningId");
    if (
      typeof request.version !== "string" ||
      !/^[a-f0-9]{32}$/.test(request.version)
    ) {
      throw new RangeError(
        "version must be the token returned with the study item",
      );
    }
  };
  const validateCard = (
    candidate: StudyCandidate,
    userId: number,
    request: PreviewRequest,
    now: Date,
  ) => {
    if (candidate.progress) validateProgress(candidate.progress, now);
    if (
      getProgressVersion(userId, candidate.meaning.id, candidate.progress) !==
      request.version
    ) {
      throw new StudyError(
        "STALE_CARD",
        "This card has changed since it was displayed",
      );
    }
    if (
      candidate.progress &&
      candidate.progress.due.getTime() > now.getTime()
    ) {
      throw new StudyError("CARD_NOT_DUE", "This card is not due yet");
    }
  };
  const validateBudget = (context: ReviewContext) => {
    const { candidate, activity } = context;
    const budget = getStudyBudget(context, policy);
    if (
      (!candidate.progress || candidate.progress.state === State.New) &&
      !activity.introducedMeaningIds.includes(candidate.meaning.id) &&
      budget.newRemaining === 0
    ) {
      throw new StudyError(
        "DAILY_LIMIT",
        "The new-card budget is exhausted or reviews need attention first",
      );
    }
    if (
      candidate.progress?.state === State.Review &&
      !activity.reviewedMeaningIds.includes(candidate.meaning.id) &&
      budget.reviewRemaining === 0
    ) {
      throw new StudyError(
        "DAILY_LIMIT",
        "The daily review budget is exhausted",
      );
    }
  };

  const service = {
    get policy() {
      return policy;
    },
    getParameters: engine.getParameters,
    async getStudyQueue(userId: number, query: StudyQueueOptions = {}) {
      validateId(userId, "userId");
      if (query.deckId !== undefined) validateId(query.deckId, "deckId");
      const limit = query.limit ?? policy.queueLimit;
      if (!Number.isSafeInteger(limit) || limit < 0 || limit > 1000) {
        throw new RangeError("limit must be an integer between 0 and 1000");
      }
      if (query.recentCardIds !== undefined) {
        if (
          !Array.isArray(query.recentCardIds) ||
          query.recentCardIds.length > 1000
        ) {
          throw new RangeError(
            "recentCardIds must be an array of up to 1000 card IDs",
          );
        }
        for (const id of query.recentCardIds) validateId(id, "recent card ID");
      }
      const now = getNow(query.now);
      const day = getStudyDay(now, query.timeZone ?? policy.timeZone);
      const snapshot = repository.loadSnapshot(
        userId,
        now,
        day,
        query.deckId,
        limit === 0 ? 0 : limit + policy.siblingSpacing,
        {
          siblingSpacing: policy.siblingSpacing,
          recentCardIds: query.recentCardIds,
        },
      );
      if (!snapshot.userExists)
        throw new StudyError("USER_NOT_FOUND", "User does not exist");
      if (
        query.deckId !== undefined &&
        !snapshot.activeDeckIds.includes(query.deckId)
      ) {
        throw new StudyError(
          "CARD_NOT_AVAILABLE",
          "The deck is not in the user's collection",
        );
      }
      return buildStudyQueue(
        snapshot,
        userId,
        now,
        day,
        policy,
        engine,
        limit,
        query.recentCardIds ?? snapshot.activity.recentCardIds ?? [],
      );
    },
    async getNextStudyCard(
      userId: number,
      query: Omit<StudyQueueOptions, "limit"> = {},
    ): Promise<StudyItem | null> {
      const queue = await service.getStudyQueue(userId, { ...query, limit: 1 });
      return queue.items[0] ?? null;
    },
    async previewCardReview(userId: number, request: PreviewRequest) {
      validateRequest(userId, request);
      const now = getNow(request.now);
      // Validate the zone even though preview does not consume a daily budget.
      getStudyDay(now, request.timeZone ?? policy.timeZone);
      const candidate = repository.getCandidate(userId, request.cardMeaningId);
      if (!candidate)
        throw new StudyError(
          "CARD_NOT_AVAILABLE",
          "Card is not in the user's collection",
        );
      validateCard(candidate, userId, request, now);
      return {
        version: request.version,
        outcomes: engine.preview(
          candidate.progress,
          now,
          `${userId}:${candidate.meaning.id}:`,
        ),
      };
    },
    async reviewCard(userId: number, request: ReviewRequest) {
      validateRequest(userId, request);
      validateGrade(request.rating);
      const now = getNow(request.now);
      const day = getStudyDay(now, request.timeZone ?? policy.timeZone);
      return repository.commitReview(
        userId,
        request.cardMeaningId,
        now,
        day,
        (context) => {
          validateCard(context.candidate, userId, request, now);
          validateBudget(context);
          return engine.schedule(
            context.candidate.progress,
            request.rating,
            now,
            `${userId}:${request.cardMeaningId}:`,
          );
        },
      );
    },
  };
  return service;
}

export type StudyService = ReturnType<typeof createStudyService>;

let defaultService: StudyService | undefined;
function getDefaultService() {
  return (defaultService ??= createStudyService());
}

export async function getStudyQueue(
  userId: number,
  options: StudyQueueOptions = {},
) {
  return getDefaultService().getStudyQueue(userId, options);
}

export async function getNextStudyCard(
  userId: number,
  options: Omit<StudyQueueOptions, "limit"> = {},
) {
  return getDefaultService().getNextStudyCard(userId, options);
}

export async function previewCardReview(
  userId: number,
  request: PreviewRequest,
) {
  return getDefaultService().previewCardReview(userId, request);
}

export async function reviewCard(userId: number, request: ReviewRequest) {
  return getDefaultService().reviewCard(userId, request);
}
