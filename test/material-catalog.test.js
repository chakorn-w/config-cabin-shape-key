import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  MATERIAL_CATALOG,
  createInitialMaterialSelection,
  getTexturePath,
} from "../src/materialCatalog.js";

function publicPath(urlPath) {
  return path.join("public", urlPath.replace(/^\//, ""));
}

test("every material family has valid default and PBR texture assets", () => {
  for (const family of Object.values(MATERIAL_CATALOG)) {
    assert.ok(family.variants[family.defaultVariant], `${family.label} has an invalid default`);
    assert.ok(fs.existsSync(publicPath(getTexturePath(family, family.normal))));
    assert.ok(fs.existsSync(publicPath(getTexturePath(family, family.orm))));

    for (const variant of Object.values(family.variants)) {
      assert.ok(fs.existsSync(publicPath(getTexturePath(family, variant.baseColor))));
    }
  }
});

test("initial material selection uses every configured family default", () => {
  assert.deepEqual(createInitialMaterialSelection(), {
    plywood: "wood",
    metalSheet: "base",
    fascia: "white",
    windowFrame: "aluminum",
    woodTimber: "base",
  });
});
