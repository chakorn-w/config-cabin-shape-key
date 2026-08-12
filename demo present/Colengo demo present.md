# Cabin Configurator Demo

Shape Key prototype:

https://config-cabin-shape-key.chakorn-w.workers.dev/

Scale-based prototype:

https://config-cabin-assignment.chakorn-w.workers.dev/

## Problems to solve

1. **Technical drawings with inconsistent angles and proportions** — Select two reliable baseline measurements (height and width), email the client for clarification, and compare the drawing against a 3D blockout. Some proportions still require visual estimation.
2. **Configuring specific product dimensions** — Compare scale-based transforms with Blender Shape Keys, object positioning, and parent relationships.
3. **UV stretching and squashing during resizing** — Use planar projection with `THREE.RepeatWrapping`; consider triplanar mapping when appropriate.
4. **Changing the window independently from the cabin** — Split the front wall into configurable regions and add independent Shape Keys for the wall opening, frame, and sashes.
5. **Maintaining the roof pitch** — Preserve the roof angle while deforming and repositioning the gables so the cabin keeps its intended silhouette.

## Planning phase

Research Three.js techniques for parametric assembly models and understand their limitations.

### Gathering references

![Gathered cabin references](<media/Screenshot from 2026-08-12 22-12-03.png>)

### Blender-to-Three.js workflow

1. Prepare the mesh and apply the required object transforms: location, rotation, and scale.
2. Use empties as reference positions for specific runtime behavior, such as window-height constraints and animation limits.
3. Export the model in GLB format.
4. Prepare tileable textures separately and load them in Three.js.

### Codex, JavaScript, and Three.js workflow

1. Define milestones and complete one feature group at a time: overall width and height, window configuration, window animation, and material configuration.
2. When a bug appears, prefer an asset-authored relationship over an unexplained hard-coded value. For example, add a reference empty or correct an object origin in Blender.

## Three.js configuration methods

1. 💀 **Scale-based transforms** — Create a modular Blender model, then use XYZ scale and position changes in Three.js.
2. 🔥 **Shape Keys / morph targets** — Model the cabin in Blender, use Shape Keys to configure its dimensions, and map millimeter values to morph-target influences in JavaScript.
3. ~~Three.js BVH-CSG wall booleans~~

# 💀 Scale-Based Transforms

Repository:

https://github.com/chakorn-w/config-cabin-assignment

Demo:

https://config-cabin-assignment.chakorn-w.workers.dev/

The core concept is to treat the aligned Blender model as an immutable reference and configure it through baseline-relative calculations in Three.js. Semantic mesh names, anchors, pivots, local axes, UVs, and vertex-color masks describe how each part should behave. Validated user dimensions are converted into controlled position, length, geometry, and material updates.

**TL;DR:** Let Three.js and JavaScript do a lot of math.

![Scale-based cabin configurator](<media/Screenshot from 2026-08-12 16-06-55.png>)

## Modeling

1. Create a cube representing the overall object dimensions and enter its size in millimeters.
2. Crop each section of the technical drawing and align it in Blender, using the measurement cube as a reference. In this case, the reference image shows incorrect cabin proportions even though the dimensions printed on the drawing are correct.
3. The primary concern is roof pitch. If cabin width changes, the roof pitch also changes. To preserve the roof angle, stretch and reposition the gable in Three.js.
4. Block out the main silhouette first, then add smaller details such as corner frames and metal sheets.
5. Split the model into modular parts according to how each part must transform. Set the origin at the bottom of meshes that need predictable height scaling.
6. Use a clear naming convention for every configurable part.

## UV mapping

1. Use tileable textures with `THREE.RepeatWrapping` and planar projection anchored to the `cabin.origin` empty.
2. Check UV scale and texel density across all modular components.

![UV mapping reference](<media/Screenshot from 2026-08-10 00-06-20.png>)
![UV checker alignment](<media/Screenshot from 2026-08-10 11-07-31.png>)
![UV texture-density test](<media/Screenshot from 2026-08-10 13-38-50.png>)

## Texturing

1. Use Three.js behavior similar to triplanar or planar projection. Repeat projected textures with:

   ```js
   texture.wrapS = THREE.RepeatWrapping;
   texture.wrapT = THREE.RepeatWrapping;
   ```

2. Use a tileable plywood texture from Poly Haven.
3. Recreate selected materials in Substance 3D Painter.
4. Export packed ORM maps at 1K resolution. This provides a practical balance between image sharpness and download size.

## Three.js and JavaScript

I used Codex to assist with coding. The scale-based approach requires many mathematical calculations across multiple files, which increases complexity. Non-uniform scaling can also taper shapes that are not rectangular. One possible correction is a vertex-color mask that determines which vertices move during deformation.

## Problems encountered

### Product height measurement

#### Wall height did not represent the real product height

**Symptom:** The old UI displayed the rectangular wall/eave height, while the real product specification measures from the ground to the roof peak. Changing width also changed the peak without changing the displayed height value.

**Fix:** Measure the transformed Blender `canbinBoundingBox` and initialize the UI from X width, Y overall height, and Z depth. The current measurement is 2000 × 2050 × 1350 mm. Overall height is the canonical state; internal wall height is derived by subtracting the width-driven ridge-cap rise.

**Precision note:** The GLB reports approximately 2050.000169 mm because of floating-point object scale. Measurements are rounded to whole millimeters so the 2050 mm reference produces zero transform delta and preserves the GLB pose.

**Current range exception:** Overall height is limited to 1800–2000 mm, so the 2050 mm Blender reference is outside the selectable range. The initial state clamps to 2000 mm and intentionally lowers the configured cabin by 50 mm from the raw reference pose. Width is limited to 1500–2500 mm and depth to 1200–1500 mm.

### Wall texture mapping

#### Authored UV checker alignment changed between modular pieces

**Symptom:** Checker cells jumped at front-wall boundaries and had a different density on side walls after resizing.

**Cause:** `texture.repeat` was calculated independently for each scaled mesh. This transformed every mesh's UV islands around its own UV origin, so deliberately aligned Blender UVs no longer shared one visible grid.

**Attempted fix:** Using Blender `TEXCOORD_0` with repeat `(1, 1)` preserved the authored default alignment, but resizing could still stretch texel density.

**Current fix:** Wall and gable textures use position-based planar mapping only. The shader converts positions to cabin-local space and subtracts `cabin.origin`:

```text
Front / Back: UV = (local X, local Y) / tile size
Sides:        UV = (local Z, local Y) / tile size
```

The checker currently uses a fixed 200 mm tile size. All modular wall pieces therefore share a stable origin and texel density regardless of their individual scale or pivot.

**Guard:** Keep `cabin.origin` in the GLB. Use authored Blender UVs for structural wood, fascia, windows, metal sheets, and corrugations; planar mapping applies only to walls and gables.

### Fascia outer cut lost its perpendicular shape

**Symptom:** The Blender-authored vertical outer cut tilted when cabin width changed because non-uniform local-Z object scaling also scaled the bevel/cut vertex offsets.

**Fix:** The active deformation mask exports as the second color set, `COLOR_1`; `COLOR_0` is an unused all-white set. Black vertices define the complete moving outer cut, and red vertices define the fixed ridge. Runtime object scale Z remains 1. Each black vertex receives the same calculated local-Z translation, while red vertices retain their immutable baseline positions. Normals, bounding boxes, and bounding spheres are recomputed after changes.

**Current two-color contract:** Both fascia meshes export a red ridge region and a black outer-cut region in `COLOR_1`. Runtime keeps every red ridge vertex at its immutable local position and gives every black outer-cut vertex the same local-Z translation. This fixes the peak while preserving the outer cut as a rigid shape.

**Guard:** Do not remove or reorder `COLOR_1` in future Blender exports. Keep `roof.fascia.anchor` and resolve it through the central semantic node map.

![Fascia deformation result](<media/Screenshot from 2026-08-12 16-07-48.png>)

# 🔥 Shape Keys / Morph Targets

Repository:

https://github.com/chakorn-w/config-cabin-shape-key

Demo:

https://config-cabin-shape-key.chakorn-w.workers.dev/

Cabin geometry is resized with Blender Shape Keys exported as glTF morph targets, while rigid parts follow related structures through parenting or reference-based transforms.

![Shape Key cabin at minimum configuration](<media/Screenshot from 2026-08-12 16-12-04.png>)
![Shape Key cabin at an intermediate configuration](<media/Screenshot from 2026-08-12 16-12-18.png>)
![Shape Key cabin at maximum configuration](<media/Screenshot from 2026-08-12 16-12-32.png>)

## Modeling

1. Create a cube representing the overall object dimensions and enter its size in millimeters.
2. Crop each section of the technical drawing and align it in Blender, using the measurement cube as a reference. In this case, the reference image shows incorrect cabin proportions even though the dimensions printed on the drawing are correct.
3. After establishing the minimum and maximum sizes, create bounding-box blockouts for both configurations. These later become dimensional references for Shape Key values in Three.js.
4. Model the cabin in its smallest configuration so the Shape Key values follow this convention:

   ```text
   shapekey_min_width/height = 0
   shapekey_max_width/height = 1
   ```

5. After completing the Basis model, create the required Shape Keys for each object.
6. Add empties as runtime references, such as fascia-origin positions, window animation markers, and collision buffers that move in relation to Shape Key values.
7. Use standard position transforms for rigid objects that should move rather than deform, such as side walls and gables.
8. Configure the gable Shape Key to meet the roof ridge at maximum size. This allows vertices to align with the roof without requiring a trigonometric formula in JavaScript.

## UV mapping

Blender UVs alone are unsuitable for configurable meshes because Shape Keys stretch and squash the geometry without changing the UV coordinates. This causes texture distortion.

Use planar projection together with repeat wrapping:

```js
texture.wrapS = THREE.RepeatWrapping;
texture.wrapT = THREE.RepeatWrapping;
```

Planar projection generates new deformation-aware UV coordinates; repeat wrapping continues the tile outside the first `0–1` UV region.

## Texturing

1. Use planar or face-aligned projection in Three.js for configurable surfaces.
2. Use a tileable plywood texture from Poly Haven.
3. Recreate selected materials in Substance 3D Painter.
4. Export packed ORM maps at 1K resolution to balance optimization and image sharpness.

## Three.js and JavaScript

I used Codex to assist with coding. In this approach, Three.js receives more authored structural data instead of calculating every relationship from scratch. User input is compared with the minimum and maximum bounding-box dimensions, normalized to a `0–1` range, and applied to the related Shape Keys.

## Problems encountered

### Increasing cabin height caused the roof/fascia assembly to float above the gables

#### Cause

The first runtime mappings treated fascia movement as a height-only relationship. The Blender references define fascia-origin positions, but their complete 400 mm range represents the combined all-minimum to all-maximum cabin configuration.

Cabin width changes the gable apex through `gable-front-width` and `gable-back-width`, contributing approximately 288.675 mm of roof rise. Cabin height contributes the remaining 111.325 mm through the wall-height Shape Keys. Moving the fascia through the full 400 mm from height alone therefore separates it from the gables when cabin width is not also at maximum.

#### Solution

Use the two Blender empties as authoritative fascia-origin endpoints, then apply both authored contributions:

```text
fascia Y = roof-height-min
          + (288.675 mm × cabin width influence)
          + (111.325 mm × cabin height influence)
```

The runtime reads both contribution sizes from the exported morph targets instead of hard-coding the millimeter values. It also validates that their sum matches the reference-empty range.

The reference empties remain part of the asset contract:

- `roof-height-min`: Y = 1.65 m
- `roof-height-max`: Y = 2.05 m

This approach replaced the earlier per-update vertex search. It is simpler and more predictable because Blender defines the endpoints and Three.js only combines normalized width and height influences. A small runtime calculation remains necessary because the fascia depends on two independent sliders.

### Window height overlaps the upper wood frame

#### Symptom

Increasing the window-height Shape Key can push the top of the window frame into or through `woodFrameFrontBack`. The full 900 mm window height is geometrically valid at maximum cabin height but does not have enough structural clearance at minimum cabin height.

#### Cause

The original window-height slider always exposed the complete exported 800–900 mm range. It treated window height as independent even though available clearance changes with cabin height.

The window and wood frame use separate Shape Keys:

- `widowFrame-height` raises the top of the window by approximately 100 mm.
- Cabin/wall height creates approximately 111.325 mm of additional upper clearance.

Without a dependency rule, Three.js correctly applies both morph targets but can combine them into a product state that overlaps.

#### Solution

Two Blender empties define the collision relationship:

- `window-buffer` represents the upper window-clearance position.
- `woodFrame-buffer` represents the lower structural-frame clearance position.

Three.js calculates the available window-height influence from the cabin-height influence:

```text
wood buffer Y = woodFrame-buffer Basis Y
                + maximum wall-height travel
                  × cabin-height influence

available window influence = clamp(
    (wood buffer Y - window-buffer Y)
    / maximum window-height travel,
    0,
    1
)

dynamic window maximum = minimum window height
                         + available window influence
                           × complete window-height range
```

The UI updates the window-height slider maximum whenever cabin height changes. At minimum cabin height, the window is limited to 800 mm. Increasing cabin height progressively unlocks taller values until the full 900 mm is available. If cabin height is reduced while the selected window is too tall, the application state, slider value, label, and Shape Key influence are clamped together.

This is a configuration constraint rather than a collision response. Invalid geometry is prevented before it is applied.

#### Validation

- At minimum cabin height, confirm the window cannot increase beyond 800 mm.
- Increase cabin height gradually and confirm the available window maximum also increases.
- At maximum cabin height, confirm the full 900 mm value is available.
- Select a tall window, reduce cabin height, and confirm the window automatically returns to the new safe maximum.
- Confirm `window-buffer` never passes through `woodFrame-buffer`.

### Sliding-window travel changes with window width

#### Symptom

A fixed X animation distance works at one window width but stops too early or moves too far after the window-width Shape Keys resize the frame and sashes.

#### Cause

Window width changes the physical distance required for the left sash to overlap the stationary right sash. Animating `window-LFT` with a hard-coded offset ignores the configured width. Directly moving the sash can also interfere with its width and height morph targets.

#### Solution

Blender provides two animation references:

- `windows-anim-check` is the animation parent of `window-LFT`.
- `windows-open-limit` represents the open X endpoint at the minimum window width.

The sash keeps its Shape Keys and local transform. Three.js animates the parent instead:

```text
half width increase =
    (selected window width - minimum window width) / 2

dynamic open limit X =
    windows-open-limit Basis X + half width increase

window travel X =
    dynamic open limit X - windows-anim-check Basis X

animation parent X =
    Basis X + window travel X × open progress
```

`open progress` moves smoothly between `0` and `1` and is clamped at both endpoints. The right sash remains stationary. If window width changes while the sash is open or moving, the dynamic travel is recalculated and the current progress is applied to the new distance.

Application state controls whether the target is open or closed; the current object position is not used as the state source.
