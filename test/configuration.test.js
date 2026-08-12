import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialConfiguration,
  normalizeDimension,
  updateConfiguration,
} from "../src/configuration.js";

const limits = {
  cabinWidthMm: { min: 1500, max: 2500 },
  cabinHeightMm: { min: 1800, max: 2200 },
  windowWidthMm: { min: 900, max: 1400 },
  windowHeightMm: { min: 800, max: 900 },
};

test("normalizes endpoints and intermediate dimensions", () => {
  assert.equal(normalizeDimension(1500, limits.cabinWidthMm), 0);
  assert.equal(normalizeDimension(2000, limits.cabinWidthMm), 0.5);
  assert.equal(normalizeDimension(2500, limits.cabinWidthMm), 1);
});

test("clamps values outside the configured range", () => {
  assert.equal(normalizeDimension(1000, limits.cabinWidthMm), 0);
  assert.equal(normalizeDimension(3000, limits.cabinWidthMm), 1);
});

test("starts every configurable dimension at its minimum", () => {
  assert.deepEqual(createInitialConfiguration(limits), {
    cabinWidthMm: 1500,
    cabinHeightMm: 1800,
    windowWidthMm: 900,
    windowHeightMm: 800,
  });
});

test("updates configuration immutably and clamps input", () => {
  const initial = createInitialConfiguration(limits);
  const updated = updateConfiguration(initial, "windowWidthMm", 1600, limits);

  assert.equal(initial.windowWidthMm, 900);
  assert.equal(updated.windowWidthMm, 1400);
  assert.notEqual(updated, initial);
});
