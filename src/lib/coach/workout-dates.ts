import { ApiError } from "../api/http";
function day(value: Date, zone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  return ["year", "month", "day"]
    .map((key) => parts.find((part) => part.type === key)!.value)
    .join("-");
}
// Find local calendar boundaries rather than assuming every day is 24 hours.
export function workoutDateWindow(requested: string, zone: string, now = new Date()) {
  const today = day(now, zone),
    offset = requested === "yesterday" ? -1 : 0;
  const key = /^\d{4}-\d{2}-\d{2}$/.test(requested)
    ? requested
    : new Date(Date.parse(today + "T00:00:00Z") + offset * 86400000).toISOString().slice(0, 10);
  if (
    !Number.isFinite(Date.parse(key + "T00:00:00Z")) ||
    new Date(key + "T00:00:00Z").toISOString().slice(0, 10) !== key
  )
    throw new ApiError(422, "INVALID_WORKOUT_DATE", "Please use a valid workout date.");
  const next = new Date(Date.parse(key + "T00:00:00Z") + 86400000).toISOString().slice(0, 10);
  const boundary = (target: string) => {
    const anchor = Date.parse(target + "T00:00:00Z");
    let low = anchor - 36 * 3600000,
      high = anchor + 36 * 3600000;
    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);
      if (day(new Date(mid), zone) < target) low = mid;
      else high = mid;
    }
    return new Date(high).toISOString();
  };
  return { from: boundary(key), until: boundary(next) };
}
