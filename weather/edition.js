export const EDITION_EPOCH = "2026-10-20";

export function easternDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
}

export function puzzleNumber(iso, epoch = EDITION_EPOCH) {
  return Math.round((utcDay(iso) - utcDay(epoch)) / 86400000) + 1;
}

export function longDate(iso) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  }).format(new Date(utcDay(iso)));
}

function utcDay(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}
