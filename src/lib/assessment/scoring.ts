export type RatingBand = {
  label: string;
  minScore: number;
  maxScore: number;
};

export function validateRatingBands(bands: RatingBand[]): string | null {
  if (!bands.length) {
    return "Add at least one rating band. No default range is applied.";
  }
  const sorted = [...bands].sort((left, right) => left.minScore - right.minScore || left.maxScore - right.maxScore);
  const labels = new Set<string>();
  let previousMax: number | null = null;
  for (const band of sorted) {
    const label = band.label.trim();
    if (!label || label.length > 80) {
      return "Each rating band needs a label of 80 characters or fewer.";
    }
    if (labels.has(label.toLowerCase())) {
      return "Rating labels must be unique.";
    }
    labels.add(label.toLowerCase());
    if (!Number.isFinite(band.minScore) || !Number.isFinite(band.maxScore) || band.minScore > band.maxScore) {
      return "Each rating band needs a minimum that does not exceed its maximum.";
    }
    if (previousMax != null && band.minScore <= previousMax) {
      return "Rating bands cannot overlap.";
    }
    previousMax = band.maxScore;
  }
  return null;
}

export function ratingForScore(
  score: number,
  bands: RatingBand[],
  approved: boolean,
): { rating: string | null; reason: string } {
  if (!approved) {
    return {
      rating: null,
      reason: "No approved rating configuration exists, so no official rating is calculated.",
    };
  }
  const invalid = validateRatingBands(bands);
  if (invalid) {
    return { rating: null, reason: invalid };
  }
  const matches = bands.filter((band) => score >= band.minScore && score <= band.maxScore);
  if (matches.length !== 1) {
    return {
      rating: null,
      reason: "The official score does not match exactly one approved rating band.",
    };
  }
  return { rating: matches[0].label.trim(), reason: "Calculated from the approved rating configuration." };
}
