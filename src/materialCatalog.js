export const MATERIAL_CATALOG = Object.freeze({
  plywood: Object.freeze({
    label: "Exterior walls",
    materialName: "plywood_MAT",
    directory: "plywood_MAT",
    normal: "plywood_MAT_normal.png",
    orm: "plywood_MAT_occlusionRoughnessMetallic.png",
    defaultVariant: "wood",
    variants: Object.freeze({
      wood: Object.freeze({ label: "Wood", color: "#a7774d", baseColor: "plywood.WOOD_MAT_baseColor.png" }),
      white: Object.freeze({ label: "White", color: "#e7e5dc", baseColor: "plywood.WHITE_MAT_baseColor.png" }),
      red: Object.freeze({ label: "Red", color: "#9f3430", baseColor: "plywood.RED_MAT_baseColor.png" }),
      teal: Object.freeze({ label: "Teal", color: "#39736e", baseColor: "plywood.TEAL_MAT_baseColor.png" }),
      yellow: Object.freeze({ label: "Yellow", color: "#d7aa31", baseColor: "plywood.YELLOW_MAT_baseColor.png" }),
    }),
  }),
  metalSheet: Object.freeze({
    label: "Roof & metalwork",
    materialName: "metalsheet_MAT",
    directory: "metalSheet_MAT",
    normal: "metalSheet.BASE_MAT_normal.png",
    orm: "metalSheet.BASE_MAT_occlusionRoughnessMetallic.png",
    defaultVariant: "base",
    variants: Object.freeze({
      base: Object.freeze({ label: "Base", color: "#aeb2b2", baseColor: "metalSheet.BASE_MAT_baseColor.png" }),
      black: Object.freeze({ label: "Black", color: "#262928", baseColor: "metalSheet.BLACK_MAT_baseColor.png" }),
      orange: Object.freeze({ label: "Orange", color: "#bc652d", baseColor: "metalSheet.ORANGE_MAT_baseColor.png" }),
      red: Object.freeze({ label: "Red", color: "#9f3430", baseColor: "metalSheet.RED_MAT_baseColor.png" }),
      teal: Object.freeze({ label: "Teal", color: "#39736e", baseColor: "metalSheet.TEAL_MAT_baseColor.png" }),
      yellow: Object.freeze({ label: "Yellow", color: "#d7aa31", baseColor: "metalSheet.YELLOW_MAT_baseColor.png" }),
    }),
  }),
  fascia: Object.freeze({
    label: "Fascia",
    materialName: "fascia_MAT",
    directory: "fascia_MAT",
    normal: "fascia.BASE_MAT_normal.png",
    orm: "fascia.BASE_MAT_occlusionRoughnessMetallic.png",
    defaultVariant: "white",
    variants: Object.freeze({
      white: Object.freeze({ label: "White", color: "#e7e5dc", baseColor: "fascia.WHITE_baseColor.png" }),
      wood: Object.freeze({ label: "Wood", color: "#a7774d", baseColor: "fascia.WOOD_MAT_baseColor.png" }),
      red: Object.freeze({ label: "Red", color: "#9f3430", baseColor: "fascia.RED_MAT_baseColor.png" }),
      teal: Object.freeze({ label: "Teal", color: "#39736e", baseColor: "fascia.TEAL_MAT_baseColor.png" }),
      yellow: Object.freeze({ label: "Yellow", color: "#d7aa31", baseColor: "fascia.YELLOW_MAT_baseColor.png" }),
    }),
  }),
  windowFrame: Object.freeze({
    label: "Window frames",
    materialName: "windowAluminum_MAT",
    directory: "windowFrame_MAT",
    normal: "windowFrame.BASE_MAT_normal.png",
    orm: "windowFrame.BASE_MAT_occlusionRoughnessMetallic.png",
    defaultVariant: "aluminum",
    variants: Object.freeze({
      aluminum: Object.freeze({ label: "Aluminum", color: "#b9bdba", baseColor: "windowFrame.ALU_MAT_baseColor.png" }),
      black: Object.freeze({ label: "Black", color: "#262928", baseColor: "windowFrame.BLACK_MAT_baseColor.png" }),
    }),
  }),
  woodTimber: Object.freeze({
    label: "Structural timber",
    materialName: "woodTiber_MAT",
    directory: "woodTimber_MAT",
    normal: "WoodTimber.BASE_MAT_normal.png",
    orm: "WoodTimber.BASE_MAT_occlusionRoughnessMetallic.png",
    defaultVariant: "base",
    hidden: true,
    variants: Object.freeze({
      base: Object.freeze({ label: "Natural", color: "#aa8058", baseColor: "WoodTimber.BASE_MAT_baseColor.png" }),
    }),
  }),
});

/** Resolve a public asset under Vite's deployment base path. */
export function getPublicAssetPath(relativePath) {
  const baseUrl = import.meta.env?.BASE_URL ?? "/";
  return `${baseUrl}${relativePath.replace(/^\//, "")}`;
}

export function getTexturePath(family, filename) {
  return getPublicAssetPath(`texture/${family.directory}/${filename}`);
}

export function createInitialMaterialSelection() {
  return Object.fromEntries(
    Object.entries(MATERIAL_CATALOG).map(([familyId, family]) => [
      familyId,
      family.defaultVariant,
    ]),
  );
}
