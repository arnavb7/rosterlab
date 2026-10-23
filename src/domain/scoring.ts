export const SCORING_CATALOG = {
  pass_yd: 0.04,
  pass_td: 4,
  pass_int: -1,
  pass_2pt: 2,
  rush_yd: 0.1,
  rush_td: 6,
  rush_2pt: 2,
  rec_yd: 0.1,
  rec_td: 6,
  rec_2pt: 2,
  fum_lost: -2,
  xpm: 1,
  xpmiss: -1,
  fgm_0_19: 3,
  fgm_20_29: 3,
  fgm_30_39: 3,
  fgm_40_49: 4,
  fgm_50p: 5,
  sack: 1,
  int: 2,
  fum_rec: 2,
  safe: 2,
  def_td: 6,
  blk_kick: 2,
  ff: 1,
  st_td: 6,
  st_ff: 1,
  st_fum_rec: 1,
  pts_allow_0: 10,
  pts_allow_1_6: 7,
  pts_allow_7_13: 4,
  pts_allow_14_20: 1,
  pts_allow_21_27: 0,
  pts_allow_28_34: -1,
  pts_allow_35p: -4,
} as const;

export const REC_POINTS = {
  STANDARD: 0,
  HALF_PPR: 0.5,
  PPR: 1,
} as const;

export type ScoringPreset = keyof typeof REC_POINTS;

const TOLERANCE = 0.001;
const REQUIRED_KEYS = ["rec", ...Object.keys(SCORING_CATALOG)];

export type ScoringKeyNote = {
  key: string;
  actual: number | null;
  expected: number | null;
};

export type ScoringClassification = {
  preset: ScoringPreset | "CUSTOM" | "INCOMPLETE";
  closestPreset: ScoringPreset | null;
  supported: boolean;
  receivingPoints: number | null;
  divergent: ScoringKeyNote[];
  unsupported: ScoringKeyNote[];
  missing: string[];
};

export function presetScoring(preset: ScoringPreset): Record<string, number> {
  return { ...SCORING_CATALOG, rec: REC_POINTS[preset] };
}

function near(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) < TOLERANCE;
}

function numericValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function matchingPreset(rec: number): ScoringPreset | null {
  for (const preset of Object.keys(REC_POINTS) as ScoringPreset[]) {
    if (near(rec, REC_POINTS[preset])) return preset;
  }
  return null;
}

export function classifyScoring(
  settings: Record<string, unknown> | null | undefined,
): ScoringClassification {
  const source = settings ?? {};
  const missing = REQUIRED_KEYS.filter((key) => numericValue(source[key]) === null);
  const rec = numericValue(source.rec);
  const catalogMatches = (Object.keys(SCORING_CATALOG) as (keyof typeof SCORING_CATALOG)[]).every(
    (key) => {
      const actual = numericValue(source[key]);
      return actual !== null && near(actual, SCORING_CATALOG[key]);
    },
  );
  const closestPreset = catalogMatches && rec !== null ? matchingPreset(rec) : null;

  const divergent: ScoringKeyNote[] = [];
  for (const key of Object.keys(SCORING_CATALOG) as (keyof typeof SCORING_CATALOG)[]) {
    if (!(key in source)) continue;
    const actual = numericValue(source[key]);
    if (actual === null || !near(actual, SCORING_CATALOG[key])) {
      divergent.push({ key, actual, expected: SCORING_CATALOG[key] });
    }
  }
  if ("rec" in source && (rec === null || matchingPreset(rec) === null)) {
    divergent.push({ key: "rec", actual: rec, expected: null });
  }

  const unsupported: ScoringKeyNote[] = [];
  for (const [key, value] of Object.entries(source)) {
    if (REQUIRED_KEYS.includes(key)) continue;
    const actual = numericValue(value);
    if (actual === null || !near(actual, 0)) {
      unsupported.push({ key, actual, expected: null });
    }
  }

  const supported = closestPreset !== null && missing.length === 0 && unsupported.length === 0;
  let preset: ScoringClassification["preset"] = "CUSTOM";
  if (supported && closestPreset) preset = closestPreset;
  else if (missing.length > 0 && divergent.length === 0 && unsupported.length === 0) {
    preset = "INCOMPLETE";
  }

  return {
    preset,
    closestPreset,
    supported,
    receivingPoints: rec,
    divergent,
    unsupported,
    missing,
  };
}
