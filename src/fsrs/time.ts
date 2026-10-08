const DAY_MS = 24 * 60 * 60 * 1_000;
const MIN_DATE_MS = -8_640_000_000_000_000;
const MAX_DATE_MS = 8_640_000_000_000_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

export function validateDate(value: Date, label = "now"): void {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new RangeError(`${label} must be a valid Date.`);
  }
}

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  if (
    typeof timeZone !== "string" ||
    timeZone.length === 0 ||
    /^[+-]/.test(timeZone)
  ) {
    throw new RangeError("timeZone must be a valid IANA time zone.");
  }

  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      calendar: "gregory",
      numberingSystem: "latn",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      era: "short",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

function getLocalDay(formatter: Intl.DateTimeFormat, instant: number) {
  const parts = formatter.formatToParts(new Date(instant));
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)!.value;
  const displayedYear = Number(getPart("year"));
  const year = getPart("era") === "BC" ? 1 - displayedYear : displayedYear;
  const month = Number(getPart("month"));
  const day = Number(getPart("day"));
  const yearLabel =
    year >= 0 && year <= 9_999
      ? String(year).padStart(4, "0")
      : `${year < 0 ? "-" : "+"}${String(Math.abs(year)).padStart(6, "0")}`;

  return {
    key: `${yearLabel}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    ordinal: year * 372 + (month - 1) * 31 + day,
  };
}

function findBoundary(
  before: number,
  after: number,
  reachesBoundary: (instant: number) => boolean,
): number {
  while (after - before > 1) {
    const middle = before + Math.floor((after - before) / 2);
    if (reachesBoundary(middle)) {
      after = middle;
    } else {
      before = middle;
    }
  }
  return after;
}

export function getStudyDay(
  now: Date,
  timeZone: string,
): { key: string; start: Date; end: Date } {
  validateDate(now);
  const formatter = getFormatter(timeZone);
  const instant = now.getTime();
  const day = getLocalDay(formatter, instant);
  const before = Math.max(MIN_DATE_MS, instant - 3 * DAY_MS);
  const after = Math.min(MAX_DATE_MS, instant + 3 * DAY_MS);
  const localOrdinal = (value: number) => getLocalDay(formatter, value).ordinal;

  if (
    localOrdinal(before) >= day.ordinal ||
    localOrdinal(after) <= day.ordinal
  ) {
    throw new RangeError("The study day exceeds Date's representable range.");
  }

  const start = findBoundary(
    before,
    instant,
    (value) => localOrdinal(value) >= day.ordinal,
  );
  const end = findBoundary(
    instant,
    after,
    (value) => localOrdinal(value) > day.ordinal,
  );

  return { key: day.key, start: new Date(start), end: new Date(end) };
}
