const PACING_MESSAGES = {
  goalReached: [
    "Goal reached—great job!",
    "You hit this goal—amazing work!",
    "Target met—nicely done!",
  ],
  onTrackEarly: [
    "Nice start—keep this rhythm.",
    "Strong opening—stay steady.",
    "Good early pace—carry it forward.",
  ],
  onTrackMid: [
    "You’re right on track this period.",
    "Steady pace—looking good.",
    "Keeping pace nicely—stay consistent.",
  ],
  onTrackLate: [
    "You’re on pace to finish—keep it up.",
    "Closing in right on schedule.",
    "Steady finish—maintain this rhythm.",
  ],
  nearPaceEarly: [
    "You’re close—add a little when you can.",
    "Almost on pace—one more effort helps.",
    "Just a bit more to stay on track.",
  ],
  nearPaceLate: [
    "Close to pace—one or two efforts will do it.",
    "Nearly there—finish strong.",
    "Just a little push to stay on course.",
  ],
  gentleEarly: [
    "Early in the period—ease into it.",
    "Plenty of time—light steps are fine.",
    "A gentle start—add a bit later.",
  ],
  gentleLate: [
    "Still time to add a small effort.",
    "A little movement now will help you finish.",
    "A short session keeps momentum alive.",
  ],
};

const stablePick = (list: string[], seed: string) => {
  if (!list.length) return "";
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i)) % 2147483647;
  }
  return list[hash % list.length];
};

const startOfWeek = (d: Date) => {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Monday = 0
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
};

const startOfMonth = (d: Date) => {
  const date = new Date(d.getFullYear(), d.getMonth(), 1);
  date.setHours(0, 0, 0, 0);
  return date;
};

const startOfYear = (d: Date) => {
  const date = new Date(d.getFullYear(), 0, 1);
  date.setHours(0, 0, 0, 0);
  return date;
};

const getPeriodElapsedRatio = (
  period?: "week" | "month" | "year",
  now = new Date()
) => {
  if (!period) return 1;
  const start =
    period === "week"
      ? startOfWeek(now)
      : period === "month"
      ? startOfMonth(now)
      : startOfYear(now);
  const end = new Date(start);
  if (period === "week") end.setDate(start.getDate() + 7);
  else if (period === "month") end.setMonth(start.getMonth() + 1);
  else end.setFullYear(start.getFullYear() + 1);

  const total = end.getTime() - start.getTime();
  const elapsed = Math.max(
    0,
    Math.min(total, now.getTime() - start.getTime())
  );
  return total > 0 ? elapsed / total : 1;
};

export function getPacingMessage(
  ratio: number,
  period?: "week" | "month" | "year",
  seed?: string
) {
  if (!period) return null;
  const dailySeed =
    seed || `goal-${period}-${new Date().toISOString().slice(0, 10)}`;

  if (ratio >= 1) return stablePick(PACING_MESSAGES.goalReached, dailySeed);

  const elapsed = getPeriodElapsedRatio(period);
  const early = elapsed < 0.33;
  const late = elapsed > 0.66;

  if (ratio >= elapsed * 0.9) {
    if (early) return stablePick(PACING_MESSAGES.onTrackEarly, dailySeed);
    if (late) return stablePick(PACING_MESSAGES.onTrackLate, dailySeed);
    return stablePick(PACING_MESSAGES.onTrackMid, dailySeed);
  }

  if (ratio >= elapsed * 0.6) {
    return late
      ? stablePick(PACING_MESSAGES.nearPaceLate, dailySeed)
      : stablePick(PACING_MESSAGES.nearPaceEarly, dailySeed);
  }

  // After the very early phase, use the “late” gentle nudge so mid-period
  // users don’t see an “early” message when the period is half done.
  return early
    ? stablePick(PACING_MESSAGES.gentleEarly, dailySeed)
    : stablePick(PACING_MESSAGES.gentleLate, dailySeed);
}
