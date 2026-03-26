/**
 * Placement points awarded per game.
 * Key = player count, value = points by placement (index 0 = 1st place).
 *
 * Change these values once and they propagate everywhere.
 */
export const PLACEMENT_POINTS: Record<number, number[]> = {
  2: [3, -1],
  3: [4, 1, -1],
  4: [5, 2, 0, -1],
};

/** Return the placement points for a given player count and rank (1-based). */
export function getPlacementPoints(playerCount: number, rank: number): number {
  const table = PLACEMENT_POINTS[playerCount];
  if (!table || rank < 1 || rank > table.length) return 0;
  return table[rank - 1];
}

/** Build a human-readable hint string from the points table. */
export function placementPointsHint(): string {
  return Object.entries(PLACEMENT_POINTS)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([count, pts]) => {
      const parts = pts
        .map((p, i) => `${ordinal(i + 1)}=${p}`);
      return `${count}-player ${parts.join(', ')}`;
    })
    .join(' · ');
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
