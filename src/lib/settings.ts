export const defaultSettings = {
  newCardsPerDay: 10,
  reviewsPerDay: 100,
  reviewsPerNewCard: 3,
  maxDueReviewsForNew: 50,
  maxLearningCardsForNew: 20,
  dayStartHour: 4,
  requestRetention: 0.9,
  maximumInterval: 36500,
  enableFuzz: false,
  enableShortTerm: true,
  learningSteps: [1, 10],
  relearningSteps: [10],
};

export type StudySettings = typeof defaultSettings;
export type NumericSetting = {
  [K in keyof StudySettings]: StudySettings[K] extends number ? K : never;
}[keyof StudySettings];

export const settingLimits: Record<NumericSetting, { min: number; max: number }> = {
  newCardsPerDay: { min: 0, max: 200 },
  reviewsPerDay: { min: 0, max: 2000 },
  reviewsPerNewCard: { min: 0, max: 20 },
  maxDueReviewsForNew: { min: 0, max: 1000 },
  maxLearningCardsForNew: { min: 1, max: 200 },
  dayStartHour: { min: 0, max: 23 },
  requestRetention: { min: 0.7, max: 0.99 },
  maximumInterval: { min: 1, max: 36500 },
};

export function validateSettings(value: unknown): StudySettings {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Некорректные настройки обучения.");
  const input = value as Record<string, unknown>;
  const result = { ...defaultSettings };
  for (const key of Object.keys(settingLimits) as NumericSetting[]) {
    const number = input[key];
    const { min, max } = settingLimits[key];
    if (typeof number !== "number" || !Number.isFinite(number) ||
      number < min || number > max || (key !== "requestRetention" && !Number.isSafeInteger(number)))
      throw new Error(`Некорректное значение настройки ${key}.`);
    result[key] = number;
  }
  for (const key of ["enableFuzz", "enableShortTerm"] as const) {
    if (typeof input[key] !== "boolean") throw new Error(`Некорректная настройка ${key}.`);
    result[key] = input[key];
  }
  for (const key of ["learningSteps", "relearningSteps"] as const) {
    const steps = input[key];
    if (!Array.isArray(steps) || steps.length > 6 || !steps.every((step, index) =>
      typeof step === "number" && Number.isSafeInteger(step) && step >= 1 && step <= 1440 &&
      (index === 0 || step > steps[index - 1])))
      throw new Error("Шаги должны идти по возрастанию: до 6 значений от 1 до 1440 минут.");
    result[key] = [...steps];
  }
  return result;
}

export function parseLearningSteps(text: string): number[] {
  if (!text.trim()) return [];
  if (!/^\s*\d+(?:[\s,;]+\d+)*\s*$/.test(text))
    throw new Error("Введите шаги в минутах через запятую, например: 1, 10.");
  return text.trim().split(/[\s,;]+/).map(Number);
}

export function formatDayStart(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function getStudyDayStart(now = new Date(), hour = defaultSettings.dayStartHour) {
  const start = new Date(now);
  start.setHours(hour, 0, 0, 0);
  if (now < start) start.setDate(start.getDate() - 1);
  return start;
}
