import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { normalizeDimension } from "./configuration.js";

export const NODE_NAMES = Object.freeze({
  ground: "cabin-ground",
  fascia: "cabin-fascia",
  roofLeft: "cabin-roof-LFT",
  roofRight: "cabin-roof-RGT",
  roofRidge: "cabin-roof-ridge",
  wallFront: "cabin-wallFront",
  wallBack: "cabin-wallBack",
  wallLeft: "cabin-wall-LFT",
  wallRight: "cabin-wall-RGT",
  cornerFrameLeft: "cabin-corner-frame-LFT",
  cornerFrameRight: "cabin-corner-frame-RGT",
  woodGround: "cabin-wood_ground",
  woodFrameFrontBack: "woodFrameFrontBack",
  woodFrameSideLeft: "woodFrameSide-LFT",
  woodFrameSideRight: "woodFrameSide-RGT",
  gableFront: "cabin-wallFrontGable",
  gableBack: "cabin-wallBackGable",
  cabinOrigin: "cabin-origin",
  windowFrame: "cabinWidowFrame",
  windowLeft: "window-LFT",
  windowRight: "window-RGT",
  windowOpenLimit: "windows-open-limit",
  windowAnimationRoot: "windows-anim-check",
  windowBuffer: "window-buffer",
  woodFrameBuffer: "woodFrame-buffer",
  roofHeightMinimum: "roof-height-min",
  roofHeightMaximum: "roof-height-max",
  cabinMinimumBounds: "cabin-boundingBox-min",
  cabinMaximumBounds: "cabin-boundingBox-max",
  windowMinimumBounds: "window-boundingBox-min",
  windowMaximumBounds: "window-boundingBox-max",
});

export const MORPH_BINDINGS = Object.freeze({
  cabinWidthMm: [
    ["ground", "cabin-ground-width"],
    ["woodGround", "cabinWoodGround-width"],
    ["woodFrameFrontBack", "woodFrameFrontBack-width"],
    ["fascia", "fascia-max"],
    ["roofLeft", "roof-metalSheet-max"],
    ["roofRight", "roof-metalSheet-max"],
    ["wallFront", "wallFront-width"],
    ["wallBack", "wall-back-width"],
    ["gableFront", "gable-front-width"],
    ["gableBack", "gable-back-width"],
  ],
  cabinHeightMm: [
    ["wallFront", "wallFront-Height"],
    ["wallBack", "wall-back-height"],
    ["wallLeft", "wallHeightLFT-max"],
    ["wallRight", "wallHeightRGT.max"],
    ["cornerFrameLeft", "cornerFrame-LFT-max"],
    ["cornerFrameRight", "cornerFrame-RGT-max"],
    ["woodFrameFrontBack", "woodFrameFrontBack-height"],
    ["woodFrameSideLeft", "woodFrameSide-LFT-height"],
    ["woodFrameSideRight", "woodFrameSide-RGT-height"],
  ],
  windowWidthMm: [
    ["wallFront", "wallFrontWindow-width"],
    ["windowFrame", "widowFrame-width"],
    ["windowLeft", "window-LFT-width"],
    ["windowRight", "window-RGT-width"],
  ],
  windowHeightMm: [
    ["wallFront", "wallFrontWindow-height"],
    ["windowFrame", "widowFrame-height"],
    ["windowLeft", "window-LFT-height"],
    ["windowRight", "window-LFT-height"],
  ],
});

function requireNodes(scene) {
  const nodes = {};

  for (const [key, name] of Object.entries(NODE_NAMES)) {
    // GLTFLoader removes dots from node names for animation-path compatibility.
    const runtimeName = THREE.PropertyBinding.sanitizeNodeName(name);
    const node = scene.getObjectByName(runtimeName);
    if (!node) throw new Error(`Required GLB node is missing: ${name}`);
    nodes[key] = node;
  }

  return nodes;
}

function requireMorphTarget(node, morphName) {
  const index = node.morphTargetDictionary?.[morphName];
  if (index === undefined) {
    throw new Error(`Required morph target is missing: ${node.name} → ${morphName}`);
  }
  return index;
}

function measureNodeMillimeters(node) {
  // Bounds are authored as reference meshes, so measure them before hiding them.
  const size = new THREE.Box3().setFromObject(node).getSize(new THREE.Vector3());
  return {
    width: Math.round(size.x * 1000),
    height: Math.round(size.y * 1000),
    depth: Math.round(size.z * 1000),
  };
}

function getHeightTranslation(nodes) {
  const morphIndex = requireMorphTarget(nodes.wallFront, "wallFront-Height");
  const positions = nodes.wallFront.geometry.morphAttributes.position?.[morphIndex];
  if (!positions) throw new Error("Front-wall height morph has no position data.");

  // The highest positive morph delta is the exact offset needed by rigid upper parts.
  let maximumOffset = 0;
  for (let vertexIndex = 0; vertexIndex < positions.count; vertexIndex += 1) {
    maximumOffset = Math.max(maximumOffset, positions.getY(vertexIndex));
  }
  return maximumOffset;
}

function getMaximumVerticalMorphOffset(node, morphName) {
  const morphIndex = requireMorphTarget(node, morphName);
  const positions = node.geometry.morphAttributes.position?.[morphIndex];
  if (!positions) throw new Error(`${node.name} → ${morphName} has no position data.`);

  let maximumOffset = 0;
  for (let vertexIndex = 0; vertexIndex < positions.count; vertexIndex += 1) {
    maximumOffset = Math.max(maximumOffset, positions.getY(vertexIndex));
  }
  return maximumOffset;
}

/** Load the asset and expose configuration behavior without leaking scene internals. */
export async function loadCabinModel(url) {
  const gltf = await new GLTFLoader().loadAsync(url);
  const scene = gltf.scene;
  const nodes = requireNodes(scene);

  const cabinMinimum = measureNodeMillimeters(nodes.cabinMinimumBounds);
  const cabinMaximum = measureNodeMillimeters(nodes.cabinMaximumBounds);
  const windowMinimum = measureNodeMillimeters(nodes.windowMinimumBounds);
  const windowMaximum = measureNodeMillimeters(nodes.windowMaximumBounds);

  const limits = Object.freeze({
    cabinWidthMm: Object.freeze({ min: cabinMinimum.width, max: cabinMaximum.width }),
    cabinHeightMm: Object.freeze({ min: cabinMinimum.height, max: cabinMaximum.height }),
    windowWidthMm: Object.freeze({ min: windowMinimum.width, max: windowMaximum.width }),
    windowHeightMm: Object.freeze({ min: windowMinimum.height, max: windowMaximum.height }),
    cabinDepthMm: cabinMinimum.depth,
  });

  // Resolve the complete asset contract once so runtime slider updates stay simple.
  const resolvedMorphs = Object.fromEntries(
    Object.entries(MORPH_BINDINGS).map(([dimensionKey, bindings]) => [
      dimensionKey,
      bindings.map(([nodeKey, morphName]) => ({
        node: nodes[nodeKey],
        index: requireMorphTarget(nodes[nodeKey], morphName),
      })),
    ]),
  );

  const referenceNodes = [
    nodes.cabinMinimumBounds,
    nodes.cabinMaximumBounds,
    nodes.windowMinimumBounds,
    nodes.windowMaximumBounds,
  ];
  referenceNodes.forEach((node) => { node.visible = false; });

  const basePositions = {
    wallLeft: nodes.wallLeft.position.clone(),
    wallRight: nodes.wallRight.position.clone(),
    gableFront: nodes.gableFront.position.clone(),
    gableBack: nodes.gableBack.position.clone(),
    roofHeightMinimum: nodes.roofHeightMinimum.position.clone(),
    roofHeightMaximum: nodes.roofHeightMaximum.position.clone(),
    windowOpenLimit: nodes.windowOpenLimit.position.clone(),
    windowAnimationRoot: nodes.windowAnimationRoot.position.clone(),
  };
  const maximumHeightOffset = getHeightTranslation(nodes);
  const maximumWindowHeightOffset = getMaximumVerticalMorphOffset(
    nodes.windowFrame,
    "widowFrame-height",
  );
  const maximumWidthRoofOffset = getMaximumVerticalMorphOffset(
    nodes.gableFront,
    "gable-front-width",
  );
  const roofReferenceTravel = basePositions.roofHeightMaximum.y
    - basePositions.roofHeightMinimum.y;
  const expectedRoofTravel = maximumWidthRoofOffset + maximumHeightOffset;
  if (Math.abs(roofReferenceTravel - expectedRoofTravel) > 0.001) {
    throw new Error(
      "Roof height references do not match the combined width and height deformation.",
    );
  }
  let windowOpenProgress = 0;
  let windowOpenTarget = 0;
  let windowTravelX = basePositions.windowOpenLimit.x
    - basePositions.windowAnimationRoot.x;

  function getWindowHeightMaximumMm(cabinHeightMm) {
    const cabinHeightInfluence = normalizeDimension(cabinHeightMm, limits.cabinHeightMm);
    const windowBufferY = nodes.windowBuffer.position.y;
    const woodBufferY = nodes.woodFrameBuffer.position.y
      + maximumHeightOffset * cabinHeightInfluence;
    const availableWindowInfluence = THREE.MathUtils.clamp(
      (woodBufferY - windowBufferY) / maximumWindowHeightOffset,
      0,
      1,
    );
    return Math.floor(
      limits.windowHeightMm.min
      + availableWindowInfluence
        * (limits.windowHeightMm.max - limits.windowHeightMm.min),
    );
  }

  function applyConfiguration(configuration) {
    const influences = Object.fromEntries(
      Object.keys(resolvedMorphs).map((key) => [
        key,
        normalizeDimension(configuration[key], limits[key]),
      ]),
    );

    for (const [key, bindings] of Object.entries(resolvedMorphs)) {
      bindings.forEach(({ node, index }) => {
        node.morphTargetInfluences[index] = influences[key];
      });
    }

    // Side walls remain rigid and follow half of the cabin-width increase.
    const halfWidthIncrease = ((configuration.cabinWidthMm - limits.cabinWidthMm.min) / 1000) / 2;
    nodes.wallLeft.position.x = basePositions.wallLeft.x - halfWidthIncrease;
    nodes.wallRight.position.x = basePositions.wallRight.x + halfWidthIncrease;

    // Width raises the pitched roof while height raises the wall top. Together these
    // authored contributions reach roof-height-max without separating mixed states.
    const upperOffset = maximumHeightOffset * influences.cabinHeightMm;
    nodes.gableFront.position.y = basePositions.gableFront.y + upperOffset;
    nodes.gableBack.position.y = basePositions.gableBack.y + upperOffset;
    nodes.fascia.position.copy(basePositions.roofHeightMinimum);
    nodes.fascia.position.y += maximumWidthRoofOffset * influences.cabinWidthMm
      + maximumHeightOffset * influences.cabinHeightMm;

    // The opening limit follows half the added window width, matching its right edge.
    const halfWindowWidthIncrease = (
      (configuration.windowWidthMm - limits.windowWidthMm.min) / 1000
    ) / 2;
    nodes.windowOpenLimit.position.x = basePositions.windowOpenLimit.x
      + halfWindowWidthIncrease;
    windowTravelX = nodes.windowOpenLimit.position.x
      - basePositions.windowAnimationRoot.x;
    nodes.windowAnimationRoot.position.x = basePositions.windowAnimationRoot.x
      + windowTravelX * windowOpenProgress;
  }

  function setWindowOpen(isOpen) {
    windowOpenTarget = isOpen ? 1 : 0;
  }

  function updateAnimation(deltaSeconds) {
    if (windowOpenProgress === windowOpenTarget) return;

    // Move at a constant normalized rate and clamp exactly at the Blender limit.
    const direction = Math.sign(windowOpenTarget - windowOpenProgress);
    windowOpenProgress = THREE.MathUtils.clamp(
      windowOpenProgress + direction * deltaSeconds / 0.65,
      0,
      1,
    );
    if (Math.abs(windowOpenTarget - windowOpenProgress) < 0.001) {
      windowOpenProgress = windowOpenTarget;
    }
    nodes.windowAnimationRoot.position.x = basePositions.windowAnimationRoot.x
      + windowTravelX * windowOpenProgress;
  }

  return {
    scene,
    limits,
    applyConfiguration,
    setWindowOpen,
    updateAnimation,
    getWindowHeightMaximumMm,
  };
}
