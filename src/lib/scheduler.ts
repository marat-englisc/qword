import { fsrs, Rating, type Grade } from "ts-fsrs";

export const scheduler = fsrs({ enable_fuzz: false });

export const ratings: {
  value: Grade;
  label: string;
  color: string;
  background: string;
}[] = [
  {
    value: Rating.Again,
    label: "Снова",
    color: "#A04545",
    background: "#FAECE9",
  },
  {
    value: Rating.Hard,
    label: "Трудно",
    color: "#936321",
    background: "#FBF0DC",
  },
  {
    value: Rating.Good,
    label: "Помню",
    color: "#347163",
    background: "#E5F1EB",
  },
  {
    value: Rating.Easy,
    label: "Легко",
    color: "#6250A6",
    background: "#EEE8FA",
  },
];

export function formatInterval(due: Date | number, now = Date.now()) {
  const minutes = Math.max(
    1,
    Math.ceil((new Date(due).getTime() - now) / 60_000),
  );
  if (minutes < 60) return `${minutes} мин`;
  if (minutes < 1440) return `${Math.ceil(minutes / 60)} ч`;
  return `${Math.ceil(minutes / 1440)} дн`;
}
