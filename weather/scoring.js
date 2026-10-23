// Pure scoring logic. No DOM, no network. Config comes from config.json.

export function haversineKm(a, b) {
  const R = 6371.0088;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function tierFor(km, cfg) {
  for (const t of cfg.tiers) {
    if (t.maxKm === null || km <= t.maxKm) return t;
  }
  return cfg.tiers[cfg.tiers.length - 1];
}

// clueNumber is 1-based; clue 1 is shown at the start (cost 0 by default).
export function clueCost(clueNumber, cfg) {
  const c = cfg.clueCosts[clueNumber - 1];
  if (c === undefined) throw new Error(`No cost configured for clue ${clueNumber}`);
  return c;
}

export function afterClue(points, clueNumber, cfg) {
  return Math.max(0, points - clueCost(clueNumber, cfg));
}

export function afterWrongGuess(points, km, cfg) {
  const t = tierFor(km, cfg);
  return { points: Math.max(0, Math.round(points * (1 - t.penalty))), tier: t };
}

// Partial credit when all guesses miss or the player gives up.
export function failScore(bestKm, cfg) {
  const { max, scaleKm } = cfg.failScore;
  return Math.round(max * Math.exp(-bestKm / scaleKm));
}

// Naming the city keeps the points left on the board, and never scores
// below the best a missed round can earn.
export function winScore(points, cfg) {
  return Math.max(points, cfg.failScore.max);
}
