import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { loadCabinModel } from "./cabinModel.js";
import { createMaterialController } from "./materialController.js";
import {
  createInitialMaterialSelection,
  getPublicAssetPath,
} from "./materialCatalog.js";
import { createInitialConfiguration, updateConfiguration } from "./configuration.js";
import { createInterface } from "./interface.js";
import "./styles.css";

const app = document.querySelector("#app");
app.innerHTML = `
  <main class="layout">
    <section class="viewer" aria-label="Interactive cabin preview">
      <canvas data-canvas></canvas>
      <div class="status" data-status>Loading cabin model…</div>
    </section>
    <aside class="panel">
      <p class="eyebrow">Shape Key Prototype</p>
      <h1>Cabin configurator</h1>
      <p class="intro">Adjust the exported Blender morph targets and inspect the cabin from every angle.</p>
      <div class="controls" data-controls aria-busy="true"></div>
      <div class="fixed-dimension"><span>Fixed depth</span><strong data-depth>—</strong></div>
      <p class="note">Cabin height uses the exported min/max envelope. Roof height also changes with cabin width in this prototype asset.</p>
    </aside>
  </main>`;

const canvas = app.querySelector("[data-canvas]");
const viewer = app.querySelector(".viewer");
const status = app.querySelector("[data-status]");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdfe6e2);

const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 100);
camera.position.set(3.7, 2.7, 4.2);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = false;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.target.set(0, 0.9, 0);
controls.minDistance = 2.5;
controls.maxDistance = 9;

function addFallbackLighting() {
  // Keep the model usable if the optional presentation asset cannot be loaded.
  scene.add(new THREE.HemisphereLight(0xf4f8ff, 0x7f8b83, 2.4));
}

// The HDRI has a dark lower hemisphere, so add neutral fill for roof undersides.
scene.add(new THREE.AmbientLight(0xffffff, 0.9));

const environmentPromise = new RGBELoader()
  .loadAsync(getPublicAssetPath("HDRI/cloudy_netted_nursery_1k.hdr"))
  .then((environmentTexture) => {
    environmentTexture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = environmentTexture;
    scene.environmentIntensity = 0.5;
  })
  .catch((error) => {
    console.warn("Unable to load the HDRI; using fallback lighting.", error);
    addFallbackLighting();
  });

const grid = new THREE.GridHelper(8, 16, 0x9ba7a0, 0xc5cec9);
grid.position.y = -0.002;
scene.add(grid);
const clock = new THREE.Clock();
let cabinController = null;

function resizeRenderer() {
  const width = viewer.clientWidth;
  const height = viewer.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

new ResizeObserver(resizeRenderer).observe(viewer);
resizeRenderer();

renderer.setAnimationLoop(() => {
  cabinController?.updateAnimation(Math.min(clock.getDelta(), 0.1));
  controls.update();
  renderer.render(scene, camera);
});

try {
  // Load lighting and geometry together, then prepare textures before the first frame.
  const [cabin] = await Promise.all([
    loadCabinModel(getPublicAssetPath("3Dmesh/cabin_config.glb")),
    environmentPromise,
  ]);
  cabinController = cabin;
  const materialController = await createMaterialController(cabin.scene);
  scene.add(cabin.scene);

  cabin.scene.traverse((object) => {
    if (!object.isMesh || !object.visible) return;
    object.castShadow = false;
    object.receiveShadow = false;
  });

  let configuration = createInitialConfiguration(cabin.limits);
  let materialSelection = createInitialMaterialSelection();
  cabin.applyConfiguration(configuration);
  materialController.updateTextureProjections();
  let interfaceController;
  interfaceController = createInterface(
    app,
    cabin.limits,
    configuration,
    (key, value) => {
      configuration = updateConfiguration(configuration, key, value, cabin.limits);
      if (key === "cabinHeightMm") {
        const windowHeightMaximum = cabin.getWindowHeightMaximumMm(
          configuration.cabinHeightMm,
        );
        configuration = updateConfiguration(
          configuration,
          "windowHeightMm",
          Math.min(configuration.windowHeightMm, windowHeightMaximum),
          cabin.limits,
        );
        interfaceController.setWindowHeightMaximum(
          windowHeightMaximum,
          configuration.windowHeightMm,
        );
      }
      cabin.applyConfiguration(configuration);
      materialController.updateTextureProjections();
    },
    (isOpen) => cabin.setWindowOpen(isOpen),
    materialSelection,
    async (familyId, variantId) => {
      await materialController.applyMaterialVariant(familyId, variantId);
      materialSelection = { ...materialSelection, [familyId]: variantId };
    },
  );
  interfaceController.setWindowHeightMaximum(
    cabin.getWindowHeightMaximumMm(configuration.cabinHeightMm),
    configuration.windowHeightMm,
  );

  app.querySelector("[data-controls]").setAttribute("aria-busy", "false");
  status.hidden = true;
} catch (error) {
  console.error(error);
  status.classList.add("status--error");
  status.textContent = `Unable to load the cabin: ${error.message}`;
}
