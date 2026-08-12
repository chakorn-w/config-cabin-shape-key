# Cabin Configurator

A web-based cabin configurator built with JavaScript, Three.js, Vite, and a Blender-authored GLB model. Cabin geometry is resized with Blender Shape Keys exported as glTF morph targets, while rigid parts follow related structures through parenting or reference-based transforms.

The prototype currently supports:

- Cabin width: 1500–2500 mm
- Cabin height: 1800–2200 mm
- Window width: 900–1400 mm
- Window height: dynamically constrained between 800–900 mm
- Fixed cabin depth: 1350 mm
- Sliding window open/close animation
- PBR materials with selectable baked color variants
- HDRI environment lighting
- Deformation-aware planar texture projection

## Core concept

Blender owns geometry deformation. Three.js owns configurator state and applies the exported deformation rules.

```text
UI dimensions in millimeters
          │
          ▼
Application configuration state
          │
          ├── Normalize each supported range to 0–1
          ├── Apply Blender morph-target influences
          ├── Move rigid relational components
          ├── Enforce geometry constraints
          └── Recalculate projected texture coordinates
```

The minimum cabin configuration is the Shape Key Basis. Maximum Shape Keys describe the supported deformation endpoint. Morph influences are clamped to `0–1`; the application does not extrapolate unsupported geometry.

Cabin depth is fixed and is not part of the configuration state.

## Blender Shape Key to Three.js data flow

The configurator follows a reusable pipeline for turning Blender Shape Keys into product dimensions controlled by Three.js.

```text
Blender authoring
  Basis = minimum supported product
  Shape Key = deformation from minimum to maximum
  Empty/bounds = measurements, limits, pivots, and collision references
  Parenting = rigid relational movement
          │
          ▼ Export GLB with Shape Keys enabled
glTF asset contract
  Blender objects      → glTF nodes
  Blender mesh data    → glTF meshes/primitives
  Shape Keys           → morph targets + target names
  Object hierarchy     → node parent/child hierarchy
  Materials and UVs    → glTF material and texture attributes
          │
          ▼ Load with GLTFLoader
Three.js runtime binding
  scene.getObjectByName()          → required product parts
  mesh.morphTargetDictionary       → Shape Key name → influence index
  mesh.morphTargetInfluences       → active normalized values
  exported empties/bounds          → dimensions and relational references
          │
          ▼ Apply application state
Configurator behavior
  Millimeter value → clamp to range → normalize to 0–1
                  → set all related morph influences
                  → update rigid transforms and parented parts
                  → enforce dependent constraints
                  → regenerate projected UVs
                  → render the configured product
```

### 1. Author the minimum product in Blender

The Shape Key Basis represents the minimum supported configuration, not an arbitrary modeling state. Each parameter has a separate maximum Shape Key wherever possible:

- Cabin width
- Wall height
- Window width
- Window height

Topology and vertex count must remain identical across all Shape Keys. A Shape Key should deform only the geometry related to its parameter so independent controls can be combined safely.

### 2. Separate deformation from rigid movement

Not every product part should stretch. Use Shape Keys for geometry that changes form, and use object transforms or parenting for parts that should preserve their shape:

- Side walls move outward instead of stretching across cabin width.
- Corner and side frames inherit movement from their wall parents.
- Roof sheets and ridge inherit fascia transforms.
- The sliding sash moves through a dedicated animation parent.

Blender empties provide authored runtime references such as minimum/maximum positions, animation limits, and clearance buffers. This keeps structural measurements in the 3D asset rather than scattering unexplained offsets through JavaScript.

### 3. Export Shape Keys as glTF morph targets

Blender's glTF exporter converts compatible Shape Keys into morph-target position and normal deltas. The exported mesh contains:

```text
morphTargetDictionary = {
  "wallFront-width": 0,
  "wallFront-Height": 1,
  "wallFrontWindow-width": 2,
  "wallFrontWindow-height": 3
}

morphTargetInfluences = [0, 0, 0, 0]
```

The dictionary maps stable Blender Shape Key names to array indices. The influences array contains the current values applied by Three.js. A value of `0` is the Basis and `1` is the authored maximum.

Object, material, Shape Key, empty, and hierarchy names form a public asset contract. Renaming one in Blender requires updating the runtime binding or preserving backward compatibility.

### 4. Discover and validate the asset in Three.js

`GLTFLoader` creates the Three.js scene hierarchy. `src/cabinModel.js` resolves every required node, looks up each morph target by name, validates reference objects, and captures Basis transforms before interaction begins.

The application never assumes that morph indices are fixed. It always resolves an index from `morphTargetDictionary`:

```js
const influenceIndex = mesh.morphTargetDictionary[shapeKeyName];
mesh.morphTargetInfluences[influenceIndex] = normalizedValue;
```

Some glTF node names are sanitized by `GLTFLoader`; runtime lookup passes source names through `THREE.PropertyBinding.sanitizeNodeName()`. Shape Key dictionary names use their exact exported spelling.

Automated asset-contract tests load the production GLB and verify required nodes, morph names, bounds, materials, and parent relationships. A broken Blender export therefore fails before it becomes a silent visual bug.

### 5. Map physical dimensions to normalized influences

The application state stores user-facing millimeter dimensions and remains the source of truth. Morph values are derived output, never the source of product measurements.

```text
normalized = (selected millimeters - minimum millimeters)
             / (maximum millimeters - minimum millimeters)
```

For example, cabin width 2000 mm within a 1500–2500 mm range produces influence `0.5`. That one state value is sent to every mesh participating in cabin width, including walls, ground, roof, fascia, gables, and structural framing.

```js
const normalizedWidth = (2000 - 1500) / (2500 - 1500); // 0.5

for (const binding of cabinWidthBindings) {
  binding.mesh.morphTargetInfluences[binding.index] = normalizedWidth;
}
```

Values are clamped to the supported range so the runtime never extrapolates beyond the Shape Keys authored and validated in Blender.

### 6. Apply relational transforms after morph influences

After morph values are assigned, Three.js updates rigid relationships from captured Basis transforms and exported references:

```text
Cabin width influence
  ├── applies width morph targets
  ├── moves left wall by -½ width increase
  └── moves right wall by +½ width increase

Cabin height influence
  ├── applies height morph targets
  ├── moves gables above the wall top
  └── contributes to the fascia origin position
```

Every transform is recomputed from application state and saved Basis positions. It is never added to the current transform repeatedly, which prevents cumulative drift when sliders move back and forth.

### 7. Enforce dependencies between product parameters

Some dimensions are not independent across the entire product range. These relationships use Blender reference objects plus application-state constraints.

The window-height limit is one example: `window-buffer` represents the window top, while `woodFrame-buffer` represents structural clearance. Cabin height determines how much clearance exists, and the UI dynamically clamps window height before the two references overlap.

This pattern generalizes to other products:

```text
primary dimension state
        + exported reference positions
        + dependent component travel
        = safe dynamic range for another option
```

### 8. Reproject textures after deformation

Morph targets change positions but leave exported UVs unchanged. After applying a configuration, the material controller evaluates current morphed positions and normals, regenerates planar UV coordinates, and marks the UV buffer for upload. Repeat wrapping then tiles PBR textures at a stable physical scale.

The final update order is intentional:

```text
1. Update configuration state
2. Clamp dependent dimensions
3. Apply morph-target influences
4. Apply relational object transforms
5. Recalculate planar UV coordinates
6. Render
```

Following this order ensures geometry, constraints, textures, and user-visible values all describe the same product configuration.

## Geometry and relational movement

Shape Keys are used when a component must deform, including walls, gables, roof sheets, fascia, structural frames, the window opening, window frame, and window sashes.

Rigid components use Blender parenting or exported reference empties:

- Side walls move outward by half the cabin-width increase.
- Corner frames and side wood frames inherit movement from their side-wall parents.
- Roof sheets and ridge inherit fascia movement through their fascia parent.
- Gables follow the wall-height contribution.
- The fascia position combines width-driven roof rise and height-driven wall rise.
- The sliding sash moves through the `windows-anim-check` parent until it reaches `windows-open-limit`.

Object and Shape Key names are treated as an asset API. The application validates required names when loading the GLB and reports a readable error if the contract is broken.

## Fascia height logic

The Blender empties `roof-height-min` and `roof-height-max` define the minimum and maximum fascia-origin positions. Their complete 400 mm range represents the combined minimum-to-maximum cabin configuration:

```text
fascia Y = roof-height-min
          + width-driven roof rise
          + height-driven wall rise
```

The current asset contributes approximately:

- 288.675 mm from the cabin-width/gable morph
- 111.325 mm from the cabin-height/wall morph

The runtime reads these values from the exported morph targets and verifies that their sum matches the two Blender references. This keeps mixed width/height configurations attached without scanning deformed vertices every frame.

## Window behavior and constraints

Window width and height update the front-wall opening, frame, and both sashes with the same normalized influences.

The left sash is parented to `windows-anim-check`. Opening the window animates this parent along X until it reaches the width-dependent `windows-open-limit`; the right sash remains stationary.

Window height is constrained by two Blender references:

- `window-buffer` represents the top window clearance.
- `woodFrame-buffer` represents the available structural-frame clearance.

At minimum cabin height, the window is limited to 800 mm. Increasing cabin height progressively unlocks the full 900 mm window height. If cabin height is reduced, application state and the UI automatically clamp the window to the new safe maximum.

## Materials and texture projection

The GLB material names map to five PBR texture families:

| GLB material | Purpose | Configurable variants |
| --- | --- | --- |
| `plywood_MAT` | Walls and gables | Wood, White, Red, Teal, Yellow |
| `metalsheet_MAT` | Roof and metalwork | Base, Black, Orange, Red, Teal, Yellow |
| `fascia_MAT` | Fascia | White, Wood, Red, Teal, Yellow |
| `windowAluminum_MAT` | Window frame and sashes | Aluminum, Black |
| `woodTiber_MAT` | Structural timber | Fixed natural timber |

Each material uses a base-color map, normal map, and packed occlusion/roughness/metalness map. Base-color textures use sRGB; normal and ORM textures remain in linear color space.

Static Blender UVs stretch when Shape Keys resize geometry. To preserve physical texture scale, the application regenerates planar UV coordinates from current morphed vertex positions after each dimensional update:

- Plywood walls use axis-aligned projection anchored to `cabin-origin`.
- Other configurable materials use face-aligned projection derived from morphed normals.
- `THREE.RepeatWrapping` tiles textures when projected coordinates extend outside `0–1`.
- Fixed props outside the configurable material registry retain their Blender UVs.

Texture scale is configured in `src/materialController.js` with `PLYWOOD_TILE_SIZE_METERS` and `REPEATING_TILE_SIZE_METERS`.

## Problems found and solutions

### Shape Key texture stretching

Shape Keys move vertices without changing exported UVs. Repeat wrapping alone cannot correct the resulting stretch. The solution is to regenerate planar UVs from the deformed geometry, then use repeat wrapping to continue the texture beyond the first tile.

### Fascia separating from the gables

A height-only fascia transform ignored the vertical roof rise caused by cabin width. The solution combines the exported width and height morph contributions and validates them against `roof-height-min/max`.

### Window overlapping structural framing

The window could reach its maximum height before the cabin provided enough clearance. The solution derives a dynamic window-height limit from `window-buffer`, `woodFrame-buffer`, and cabin-height influence.

### Window opening exceeding the front wall

An older Shape Key allowed a 1000 mm opening to intersect the top wall face. The Blender asset was corrected and now advertises a safe 800–900 mm range through `window-boundingBox-min/max`.

### Triangular marks across surfaces

Directional shadow-map self-shadowing produced shadow acne. Real-time shadow maps are disabled for the prototype; HDRI environment lighting is used instead.

### Dark roof and fascia undersides

Downward-facing polygons sampled the HDRI's dark lower hemisphere and looked like black shadows. A neutral ambient fill keeps these surfaces readable.

### Blender names differing at runtime

`GLTFLoader` sanitizes some node names for animation paths. Runtime node lookup uses `THREE.PropertyBinding.sanitizeNodeName()`, while Shape Key dictionary names continue to use their exact exported spelling.

See [debug-docs.md](debug-docs.md) for detailed symptoms, causes, fixes, and validation steps.

## Project structure

```text
src/
  cabinModel.js         GLB contract, morph bindings, constraints, animation
  configuration.js      Dimension state, normalization, and clamping
  interface.js          Dimension, window, and material controls
  materialCatalog.js    Material families, variants, and texture paths
  materialController.js PBR loading and deformation-aware texture projection
  main.js               Three.js scene, HDRI, renderer, and integration
public/
  3Dmesh/               Production cabin GLB
  HDRI/                  Environment lighting
  texture/               PBR texture families and variants
test/                    State, asset-contract, and material-contract tests
```

## Local development

Requires Node.js 20.19+ or 22.12+.

```bash
npm ci
npm run dev
```

## Verification

Run these checks after changing application code or re-exporting the GLB:

```bash
npm test
npm run build
npm run preview
```

In addition to automated checks, visually test minimum, maximum, mixed, and intermediate configurations. Pay particular attention to roof/gable attachment, window clearance, parented structural parts, texture scale, and window animation.

## Blender re-export checklist

1. Preserve required node, material, Shape Key, and reference-object names.
2. Keep the minimum configuration as the Shape Key Basis.
3. Preserve topology and vertex counts across Shape Keys.
4. Re-export to `public/3Dmesh/cabin_config.glb`.
5. Run `npm test` to validate the asset contract.
6. Run `npm run build` and manually inspect combined slider states.

## Deployment

The production build is written to `dist/`:

```bash
npm ci
npm test
npm run build
```

Deploy the contents of `dist/` to a static host. Public asset URLs use Vite's deployment base and support root or configured subpath deployments.

The project includes search-engine exclusion through HTML `noindex` metadata, `robots.txt`, and an `_headers` file containing `X-Robots-Tag`. The `_headers` convention works on services such as Netlify and Cloudflare Pages; configure equivalent headers manually on other hosts.

Search-engine exclusion is not access control. Use authentication or host-level access restrictions if the configurator must remain private.

## Development assistance

This project was developed with assistance from OpenAI Codex. Codex helped inspect the Blender/glTF asset contract, implement the Three.js configurator, diagnose geometry and lighting behavior, add automated validation, prepare deployment configuration, and document the resulting workflow.

The Blender models, texture assets, product requirements, visual direction, and final implementation decisions are project-authored inputs. AI-generated changes were reviewed and validated through the production GLB tests, application tests, builds, and manual visual inspection.
