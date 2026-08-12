export const DIMENSION_KEYS = Object.freeze([
  "cabinWidthMm",
  "cabinHeightMm",
  "windowWidthMm",
  "windowHeightMm",
]);

/** Clamp a dimension to its asset-defined range and return its 0–1 influence. */
export function normalizeDimension(value, limits) {
  const numericValue = Number(value);
  const safeValue = Number.isFinite(numericValue) ? numericValue : limits.min;
  const clampedValue = Math.min(limits.max, Math.max(limits.min, safeValue));

  return (clampedValue - limits.min) / (limits.max - limits.min);
}

/** Create the single source of truth for configuration, starting at the Basis shape. */
export function createInitialConfiguration(limits) {
  return Object.fromEntries(
    DIMENSION_KEYS.map((key) => [key, limits[key].min]),
  );
}

/** Return a new state object so UI events never mutate the current state in place. */
export function updateConfiguration(configuration, key, value, limits) {
  if (!DIMENSION_KEYS.includes(key)) {
    throw new Error(`Unknown configuration key: ${key}`);
  }

  const range = limits[key];
  const numericValue = Number(value);
  const safeValue = Number.isFinite(numericValue) ? numericValue : range.min;
  const clampedValue = Math.min(range.max, Math.max(range.min, safeValue));

  return { ...configuration, [key]: clampedValue };
}
