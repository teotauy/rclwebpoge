export function clueCost(clueNumber, cfg) {
  const c = cfg.clueCosts[clueNumber - 1];
  if (c === undefined) throw new Error(`No cost configured for clue ${clueNumber}`);
  return c;
}

export function afterClue(points, clueNumber, cfg) {
  return Math.max(0, points - clueCost(clueNumber, cfg));
}

export function yearGap(a, b) {
  return Math.abs(a.year - b.year);
}

export function tierFor(guess, answer, cfg) {
  if (guess.director && answer.director && guess.director === answer.director) {
    return cfg.tiers.find((t) => t.name === "Same director") || cfg.tiers[0];
  }
  const years = yearGap(guess, answer);
  for (const t of cfg.tiers) {
    if (t.maxYears === undefined) continue;
    if (t.maxYears === null || years <= t.maxYears) return t;
  }
  return cfg.tiers[cfg.tiers.length - 1];
}

export function afterWrongGuess(points, guess, answer, cfg) {
  const tier = tierFor(guess, answer, cfg);
  return { points: Math.max(0, Math.round(points * (1 - tier.penalty))), tier };
}

export function failScore(guess, answer, cfg) {
  let years = guess && answer ? yearGap(guess, answer) : 40;
  if (guess && answer && guess.director && guess.director === answer.director) years = Math.min(years, 1);
  const { max, scaleYears } = cfg.failScore;
  return Math.round(max * Math.exp(-years / scaleYears));
}
