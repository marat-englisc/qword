import { getStudyDayStart } from "./settings";

export type DailyActivity = {
  day: string;
  answers: number;
  introduced: number;
  reviewAttempts: number;
  recalled: number;
  again: number;
  hard: number;
  good: number;
  easy: number;
};

export function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function dateFromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export function emptyActivity(day: string): DailyActivity {
  return { day, answers: 0, introduced: 0, reviewAttempts: 0, recalled: 0, again: 0, hard: 0, good: 0, easy: 0 };
}

export function activityDays(history: DailyActivity[], count: number, now: Date, hour: number) {
  const byDay = new Map(history.map((day) => [day.day, day]));
  const start = getStudyDayStart(now, hour);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() - count + index + 1);
    const key = localDateKey(date);
    return byDay.get(key) ?? emptyActivity(key);
  });
}

export function summarizeActivity(days: DailyActivity[]) {
  const totals = days.reduce((sum, day) => ({
    answers: sum.answers + day.answers,
    introduced: sum.introduced + day.introduced,
    reviewAttempts: sum.reviewAttempts + day.reviewAttempts,
    recalled: sum.recalled + day.recalled,
    activeDays: sum.activeDays + Number(day.answers > 0),
  }), { answers: 0, introduced: 0, reviewAttempts: 0, recalled: 0, activeDays: 0 });
  return { ...totals, recallRate: totals.reviewAttempts ? Math.round(totals.recalled / totals.reviewAttempts * 100) : null };
}

export function calculateStreaks(history: DailyActivity[], now: Date, hour: number) {
  const ordinal = (key: string) => {
    const [year, month, day] = key.split("-").map(Number);
    return Date.UTC(year, month - 1, day) / 86_400_000;
  };
  const today = ordinal(localDateKey(getStudyDayStart(now, hour)));
  const activeDays = [...new Set(history.filter((day) => day.answers > 0).map((day) => ordinal(day.day)))].sort((a, b) => a - b);
  let best = 0;
  let length = 0;
  let previous = -Infinity;
  for (const day of activeDays) {
    length = day === previous + 1 ? length + 1 : 1;
    best = Math.max(best, length);
    previous = day;
  }
  const active = new Set(activeDays);
  let cursor = active.has(today) ? today : today - 1;
  let current = 0;
  while (active.has(cursor--)) current++;
  return { current, best };
}
