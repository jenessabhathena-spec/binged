// Every tunable number in Binged lives here (SPEC §12): weights, ₹ maps, radii, limits.
// Change values here, not in the code that uses them.

export const config = {
  city: "Bengaluru",
  // Rough bounding box for Bengaluru. Start points and search areas outside it are rejected.
  cityBounds: { minLat: 12.7, maxLat: 13.3, minLng: 77.3, maxLng: 77.9 },

  deck: {
    size: 10, // every person swipes at least this many places (product decision: everyone swipes 10+)
    reserveSize: 20, // replacements kept behind the deck
    maxSameCuisine: 3, // diversity: no more than this many of one primary cuisine in a deck
  },

  search: {
    radiusMetres: 4000, // SPEC open question 2: 3 km or 6 km; start in the middle
    maxResults: 60,
  },

  travel: {
    defaultMaxMinutes: 40, // per-person dealbreaker default
  },

  plan: {
    defaultName: "Friday dinner",
    defaultDeadlineHours: 2,
    maxPartySize: 8, // groups of 8+ are out of scope for v1
    tieBreakSeconds: 60,
  },

  // Scoring weights (SPEC §7.1 step 4). Equal to start; tune weekly from swipes and ratings.
  weights: { taste: 1, fairness: 1, vibe: 1, quality: 1, novelty: 1 },

  // ₹ per person for each Google priceLevel when priceRange is missing (SPEC open question 3).
  // Placeholder values: set these after checking real Bengaluru results.
  priceLevelToRupees: {
    PRICE_LEVEL_FREE: { min: 0, max: 0 },
    PRICE_LEVEL_INEXPENSIVE: { min: 150, max: 400 },
    PRICE_LEVEL_MODERATE: { min: 400, max: 900 },
    PRICE_LEVEL_EXPENSIVE: { min: 900, max: 1800 },
    PRICE_LEVEL_VERY_EXPENSIVE: { min: 1800, max: 4000 },
  },

  budget: { min: 200, max: 4000, step: 100, default: 1000 },

  retention: {
    memberDataDays: 90, // start points and budgets deleted 90 days after the plan date
  },
} as const;

export type Config = typeof config;
