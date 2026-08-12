import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as THREE from "three";
import { MORPH_BINDINGS, NODE_NAMES } from "../src/cabinModel.js";
import { MATERIAL_CATALOG } from "../src/materialCatalog.js";

async function parseGlb(path) {
  // GLTFLoader expects the browser `self` global when an export embeds textures.
  globalThis.self ??= globalThis;
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  const source = fs.readFileSync(path);
  const data = source.buffer.slice(
    source.byteOffset,
    source.byteOffset + source.byteLength,
  );

  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(data, "", resolve, reject);
  });
}

test("the production GLB satisfies the configured node and morph contract", async () => {
  const gltf = await parseGlb("public/3Dmesh/cabin_config.glb");
  const nodes = {};

  for (const [key, sourceName] of Object.entries(NODE_NAMES)) {
    const runtimeName = THREE.PropertyBinding.sanitizeNodeName(sourceName);
    const node = gltf.scene.getObjectByName(runtimeName);
    assert.ok(node, `Missing node: ${sourceName}`);
    nodes[key] = node;
  }

  for (const bindings of Object.values(MORPH_BINDINGS)) {
    for (const [nodeKey, morphName] of bindings) {
      assert.notEqual(
        nodes[nodeKey].morphTargetDictionary?.[morphName],
        undefined,
        `Missing morph: ${NODE_NAMES[nodeKey]} → ${morphName}`,
      );
    }
  }
});

test("the GLB reference meshes preserve the expected millimeter limits", async () => {
  const gltf = await parseGlb("public/3Dmesh/cabin_config.glb");
  const measure = (sourceName) => {
    const node = gltf.scene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(sourceName));
    const size = new THREE.Box3().setFromObject(node).getSize(new THREE.Vector3());
    return [size.x, size.y, size.z].map((value) => Math.round(value * 1000));
  };

  assert.deepEqual(measure(NODE_NAMES.cabinMinimumBounds), [1500, 1800, 1350]);
  assert.deepEqual(measure(NODE_NAMES.cabinMaximumBounds), [2500, 2200, 1350]);
  assert.deepEqual(measure(NODE_NAMES.windowMinimumBounds).slice(0, 2), [900, 800]);
  assert.deepEqual(measure(NODE_NAMES.windowMaximumBounds).slice(0, 2), [1400, 900]);
});

test("the roof reference empties define the fascia height range", async () => {
  const gltf = await parseGlb("public/3Dmesh/cabin_config.glb");
  const worldY = (sourceName) => {
    const node = gltf.scene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(sourceName));
    return node.getWorldPosition(new THREE.Vector3()).y;
  };

  assert.equal(Math.round(worldY(NODE_NAMES.roofHeightMinimum) * 1000), 1650);
  assert.equal(Math.round(worldY(NODE_NAMES.roofHeightMaximum) * 1000), 2050);
});

test("relational cabin parts keep their required Blender parents", async () => {
  const gltf = await parseGlb("public/3Dmesh/cabin_config.glb");
  const getNode = (key) => gltf.scene.getObjectByName(
    THREE.PropertyBinding.sanitizeNodeName(NODE_NAMES[key]),
  );

  assert.equal(getNode("roofLeft").parent, getNode("fascia"));
  assert.equal(getNode("roofRight").parent, getNode("fascia"));
  assert.equal(getNode("roofRidge").parent, getNode("fascia"));
  assert.equal(getNode("cornerFrameLeft").parent, getNode("wallLeft"));
  assert.equal(getNode("cornerFrameRight").parent, getNode("wallRight"));
  assert.equal(getNode("woodFrameSideLeft").parent, getNode("wallLeft"));
  assert.equal(getNode("woodFrameSideRight").parent, getNode("wallRight"));
  assert.equal(getNode("windowLeft").parent, getNode("windowAnimationRoot"));
  assert.ok(getNode("windowBuffer"));
  assert.ok(getNode("woodFrameBuffer"));
});

test("visible cabin meshes use the expected Blender materials", async () => {
  const gltf = await parseGlb("public/3Dmesh/cabin_config.glb");
  const expectedMaterials = new Set(
    Object.values(MATERIAL_CATALOG).map((family) => family.materialName),
  );
  const discoveredMaterials = new Set();
  const plywoodMeshes = new Set([
    "cabin-wallFront",
    "cabin-wallBack",
    "cabin-wall-LFT",
    "cabin-wall-RGT",
    "cabin-wallFrontGable",
    "cabin-wallBackGable",
  ]);

  gltf.scene.traverse((node) => {
    if (!node.isMesh || node.name.includes("boundingBox")) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => {
      discoveredMaterials.add(material.name);
    });
    if (plywoodMeshes.has(node.name)) {
      assert.equal(node.material.name, MATERIAL_CATALOG.plywood.materialName);
    }
  });
  expectedMaterials.forEach((materialName) => {
    assert.ok(discoveredMaterials.has(materialName), `Missing controlled material ${materialName}`);
  });
});
