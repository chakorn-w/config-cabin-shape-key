import * as THREE from "three";
import { MATERIAL_CATALOG, getTexturePath } from "./materialCatalog.js";

// Increase this value to make each plywood texture tile cover a larger area.
const PLYWOOD_TILE_SIZE_METERS = 2;
const REPEATING_TILE_SIZE_METERS = 1;

function collectMaterials(scene) {
  const materials = new Map();
  scene.traverse((object) => {
    if (!object.isMesh) return;
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    objectMaterials.forEach((material) => {
      if (material?.name) materials.set(material.name, material);
    });
  });
  return materials;
}

function getMorphedLocalPosition(mesh, vertexIndex, target) {
  target.fromBufferAttribute(mesh.geometry.attributes.position, vertexIndex);
  const morphPositions = mesh.geometry.morphAttributes.position ?? [];

  for (let morphIndex = 0; morphIndex < morphPositions.length; morphIndex += 1) {
    const influence = mesh.morphTargetInfluences?.[morphIndex] ?? 0;
    if (influence === 0) continue;

    const morphPosition = new THREE.Vector3().fromBufferAttribute(
      morphPositions[morphIndex],
      vertexIndex,
    );
    if (mesh.geometry.morphTargetsRelative) {
      target.addScaledVector(morphPosition, influence);
    } else {
      target.lerp(morphPosition, influence);
    }
  }
  return target;
}

function getMorphedLocalNormal(mesh, vertexIndex, target) {
  target.fromBufferAttribute(mesh.geometry.attributes.normal, vertexIndex);
  const morphNormals = mesh.geometry.morphAttributes.normal ?? [];
  for (let morphIndex = 0; morphIndex < morphNormals.length; morphIndex += 1) {
    const influence = mesh.morphTargetInfluences?.[morphIndex] ?? 0;
    if (influence !== 0) {
      target.addScaledVector(
        new THREE.Vector3().fromBufferAttribute(morphNormals[morphIndex], vertexIndex),
        influence,
      );
    }
  }
  return target.normalize();
}

function createPlywoodProjector(scene, materialName) {
  const origin = scene.getObjectByName("cabin-origin");
  if (!origin) throw new Error("Required projection reference is missing: cabin-origin");

  const meshes = [];
  scene.traverse((object) => {
    if (object.isMesh && object.material?.name === materialName) meshes.push(object);
  });
  const originWorld = new THREE.Vector3();
  const localPosition = new THREE.Vector3();
  const worldPosition = new THREE.Vector3();

  function updateProjection() {
    scene.updateMatrixWorld(true);
    origin.getWorldPosition(originWorld);

    for (const mesh of meshes) {
      const positions = mesh.geometry.attributes.position;
      let uv = mesh.geometry.getAttribute("uv");
      if (!uv || uv.count !== positions.count) {
        uv = new THREE.BufferAttribute(new Float32Array(positions.count * 2), 2);
        mesh.geometry.setAttribute("uv", uv);
      }

      // Side walls use depth/height; front, back, and gables use width/height.
      const projectsDepth = mesh.name === "cabin-wall-LFT"
        || mesh.name === "cabin-wall-RGT";
      for (let vertexIndex = 0; vertexIndex < positions.count; vertexIndex += 1) {
        getMorphedLocalPosition(mesh, vertexIndex, localPosition);
        worldPosition.copy(localPosition).applyMatrix4(mesh.matrixWorld).sub(originWorld);
        uv.setXY(
          vertexIndex,
          (projectsDepth ? worldPosition.z : worldPosition.x) / PLYWOOD_TILE_SIZE_METERS,
          worldPosition.y / PLYWOOD_TILE_SIZE_METERS,
        );
      }
      uv.needsUpdate = true;
    }
  }

  return updateProjection;
}

function createRepeatingMaterialProjector(scene, excludedMaterialName) {
  const origin = scene.getObjectByName("cabin-origin");
  if (!origin) throw new Error("Required projection reference is missing: cabin-origin");

  const repeatMaterialNames = new Set(
    Object.values(MATERIAL_CATALOG)
      .map((family) => family.materialName)
      .filter((name) => name !== excludedMaterialName),
  );
  const meshes = [];
  scene.traverse((object) => {
    if (object.isMesh && repeatMaterialNames.has(object.material?.name)) meshes.push(object);
  });

  const originWorld = new THREE.Vector3();
  const localPosition = new THREE.Vector3();
  const worldPosition = new THREE.Vector3();
  const localNormal = new THREE.Vector3();
  const worldNormal = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const bitangent = new THREE.Vector3();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const worldRight = new THREE.Vector3(1, 0, 0);
  const normalMatrix = new THREE.Matrix3();

  function updateProjection() {
    scene.updateMatrixWorld(true);
    origin.getWorldPosition(originWorld);

    for (const mesh of meshes) {
      const positions = mesh.geometry.attributes.position;
      const uv = mesh.geometry.getAttribute("uv")
        ?? new THREE.BufferAttribute(new Float32Array(positions.count * 2), 2);
      mesh.geometry.setAttribute("uv", uv);
      normalMatrix.getNormalMatrix(mesh.matrixWorld);

      for (let vertexIndex = 0; vertexIndex < positions.count; vertexIndex += 1) {
        getMorphedLocalPosition(mesh, vertexIndex, localPosition);
        getMorphedLocalNormal(mesh, vertexIndex, localNormal);
        worldPosition.copy(localPosition).applyMatrix4(mesh.matrixWorld).sub(originWorld);
        worldNormal.copy(localNormal).applyMatrix3(normalMatrix).normalize();

        // Build a face-aligned planar basis so sloped roofs keep physical texture scale.
        tangent.crossVectors(worldUp, worldNormal);
        if (tangent.lengthSq() < 0.0001) tangent.crossVectors(worldRight, worldNormal);
        tangent.normalize();
        bitangent.crossVectors(worldNormal, tangent).normalize();
        uv.setXY(
          vertexIndex,
          worldPosition.dot(tangent) / REPEATING_TILE_SIZE_METERS,
          worldPosition.dot(bitangent) / REPEATING_TILE_SIZE_METERS,
        );
      }
      uv.needsUpdate = true;
    }
  }
  return updateProjection;
}

/** Load and cache the project's PBR maps, then apply variants to shared GLB materials. */
export async function createMaterialController(scene) {
  const loader = new THREE.TextureLoader();
  const cache = new Map();
  const materials = collectMaterials(scene);
  const familyMaterials = new Map();
  const updatePlywoodProjection = createPlywoodProjector(
    scene,
    MATERIAL_CATALOG.plywood.materialName,
  );
  const updateRepeatingMaterialProjection = createRepeatingMaterialProjector(
    scene,
    MATERIAL_CATALOG.plywood.materialName,
  );

  function loadTexture(path, colorSpace = THREE.NoColorSpace) {
    if (!cache.has(path)) {
      cache.set(path, loader.loadAsync(path).then((texture) => {
        texture.colorSpace = colorSpace;
        texture.flipY = false;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.anisotropy = 8;
        return texture;
      }).catch((error) => {
        cache.delete(path);
        throw error;
      }));
    }
    return cache.get(path);
  }

  // Resolve and validate the GLB material contract before requesting texture assets.
  for (const [familyId, family] of Object.entries(MATERIAL_CATALOG)) {
    const material = materials.get(family.materialName);
    if (!material) throw new Error(`Required GLB material is missing: ${family.materialName}`);
    familyMaterials.set(familyId, material);
  }

  await Promise.all(Object.entries(MATERIAL_CATALOG).map(async ([familyId, family]) => {
    const material = familyMaterials.get(familyId);
    const defaultVariant = family.variants[family.defaultVariant];
    const [baseColor, normal, orm] = await Promise.all([
      loadTexture(getTexturePath(family, defaultVariant.baseColor), THREE.SRGBColorSpace),
      loadTexture(getTexturePath(family, family.normal)),
      loadTexture(getTexturePath(family, family.orm)),
    ]);

    // One packed ORM texture supplies AO (R), roughness (G), and metalness (B).
    material.color.set(0xffffff);
    material.map = baseColor;
    material.normalMap = normal;
    material.aoMap = orm;
    material.roughnessMap = orm;
    material.metalnessMap = orm;
    material.roughness = 1;
    material.metalness = 1;
    material.needsUpdate = true;
  }));

  async function applyMaterialVariant(familyId, variantId) {
    const family = MATERIAL_CATALOG[familyId];
    const variant = family?.variants[variantId];
    if (!family || !variant) throw new Error(`Unknown material variant: ${familyId}/${variantId}`);

    const texture = await loadTexture(
      getTexturePath(family, variant.baseColor),
      THREE.SRGBColorSpace,
    );
    const material = familyMaterials.get(familyId);
    material.map = texture;
    material.needsUpdate = true;
  }

  updatePlywoodProjection();
  updateRepeatingMaterialProjection();
  return {
    applyMaterialVariant,
    updateTextureProjections() {
      updatePlywoodProjection();
      updateRepeatingMaterialProjection();
    },
  };
}
