# Cabin Configurator Debug Notes

This document records bugs and unexpected behavior found while connecting the Blender cabin model to Three.js. Use it when modifying the Blender file, re-exporting the GLB, or changing the runtime configuration logic.

## Window opening overlaps the top of the front wall

### Symptom

With the older GLB, setting window height to its maximum influence (`1`) made the window opening overlap or pass through the top face of `cabin.wallFront`.

### Cause

The exported `wallFrontWindow.height` Shape Key allowed more vertical deformation than the front wall could safely contain. The old `window.boundingBox.max` also advertised a 1000 mm maximum, so the UI correctly reached an asset state that was not geometrically valid.

This was a Blender geometry/constraint problem rather than a Three.js interpolation error. Three.js applied the exported morph target as authored.

### Solution

- Reduce the maximum window-height deformation in Blender so the opening remains inside the wall.
- Re-export `cabin_config.glb` with the corrected Shape Key.
- Update `window.boundingBox.max` to represent the largest safe opening.

The current asset defines a window-height range of **800–900 mm**. The UI reads this range from `window.boundingBox.min/max`, so future exports can change the range without editing application code. The asset-contract test must be updated when an intentional range change occurs.

### Validation

Check the opening at minimum, maximum, and intermediate window heights together with minimum and maximum cabin heights. Confirm that the top of the opening never intersects the wall top or gable.

## Window height overlaps the upper wood frame

### Symptom

Increasing the window-height Shape Key can push the top of the window frame into or through `woodFrameFrontBack`. The full 900 mm window height is geometrically valid at maximum cabin height but does not have enough structural clearance at minimum cabin height.

### Cause

The original window-height slider always exposed the complete exported 800–900 mm range. It treated window height as independent even though available clearance changes with cabin height.

The window and wood frame use separate Shape Keys:

- `widowFrame-height` raises the top of the window by approximately 100 mm.
- Cabin/wall height creates approximately 111.325 mm of additional upper clearance.

Without a dependency rule, Three.js correctly applies both morph targets but can combine them into a product state that overlaps.

### Solution

Two Blender empties define the collision relationship:

- `window-buffer` represents the upper window clearance position.
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

The UI updates the window-height slider maximum whenever cabin height changes. At minimum cabin height the window is limited to 800 mm. Increasing cabin height progressively unlocks taller values until the full 900 mm is available. If cabin height is reduced while the selected window is too tall, application state, slider value, label, and Shape Key influence are clamped together.

This is a configuration constraint rather than a collision response. Invalid geometry is prevented before it is applied.

### Validation

- At minimum cabin height, confirm the window cannot increase beyond 800 mm.
- Increase cabin height gradually and confirm the available window maximum also increases.
- At maximum cabin height, confirm the full 900 mm value is available.
- Select a tall window, reduce cabin height, and confirm the window automatically returns to the new safe maximum.
- Confirm `window-buffer` never passes through `woodFrame-buffer`.

## Sliding window travel changes with window width

### Symptom

A fixed X animation distance works at one window width but stops too early or moves too far after the window-width Shape Keys resize the frame and sashes.

### Cause

Window width changes the physical distance required for the left sash to overlap the stationary right sash. Animating `window-LFT` with a hard-coded offset ignores the current configured width. Directly moving the sash can also interfere with its width and height morph targets.

### Solution

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

### Validation

- Open and close the window at minimum, maximum, and intermediate widths.
- Confirm the left sash stops over the right sash without overshooting the frame.
- Change width while the sash is open and confirm it remains at the correct proportional position.
- Change width while the animation is running and confirm there is no jump or corrupted state.
- Resize window height and cabin dimensions, then confirm the animation still operates independently.

## Fascia separates from the gable

### Symptom

Increasing cabin height caused the roof/fascia assembly to float above the front and back gables.

### Cause

The first runtime mappings treated fascia movement as a height-only relationship. The current Blender references define fascia-origin positions, but their complete 400 mm range represents the combined all-minimum to all-maximum cabin configuration.

Cabin width changes the gable apex through `gable-front-width` and `gable-back-width`. It contributes approximately 288.675 mm of roof rise. Cabin height contributes the remaining 111.325 mm through the wall-height Shape Keys. Moving the fascia through the full 400 mm from height alone therefore separates it from the gables when cabin width is not also at maximum.

### Solution

Use the two Blender empties as the authoritative fascia-origin endpoints, then apply the two independent authored contributions:

```text
fascia Y = roof-height-min
          + (288.675 mm × cabin width influence)
          + (111.325 mm × cabin height influence)
```

The runtime reads both contribution sizes from the exported morph targets instead of hard-coding the millimeter values. It also validates that their sum matches the reference-empty range.

The reference empties remain part of the asset contract:

- `roof-height-min`: Y = 1.65 m
- `roof-height-max`: Y = 2.05 m

This approach replaced the earlier per-update vertex search. It is simpler and more predictable because Blender defines the endpoints and Three.js only combines normalized width and height influences. A small runtime calculation remains necessary because the fascia depends on two independent sliders rather than one.

### Validation

Inspect both gables at all four cabin width/height endpoint combinations. At all minimum values the fascia origin must equal `roof-height-min`; at all maximum values it must equal `roof-height-max`. Mixed states must remain attached without a gap or large intersection.

## Dense triangular marks across surfaces

### Symptom

The model displayed a repeating triangular or stippled pattern across otherwise flat walls and roof surfaces.

### Cause

This was shadow acne from real-time directional shadows. A mesh was casting a depth-map shadow onto nearly the same surface that received it, and limited shadow-map precision produced the repeated triangle pattern.

### Solution

Real-time shadow maps are disabled during the Shape Key prototype. Geometry validation is clearer with image-based lighting and without unstable self-shadowing. Shadows can be reintroduced later with appropriate map resolution, camera bounds, and normal bias after the final geometry is stable.

## Roof underside appears like a black triangular shadow

### Symptom

Dark triangular regions appeared below the roof or fascia even after real-time shadows were disabled.

### Cause

These regions were not cast shadows. They were downward-facing fascia surfaces receiving very little light from the HDRI's dark lower hemisphere. The exported vertex colors were checked and were uniformly white, and the base and morph normals were valid.

### Solution

Keep the HDRI for environment lighting and add a low-intensity neutral `AmbientLight`. Ambient light does not depend on surface direction, so it prevents undersides from becoming misleadingly black while preserving the HDRI's overall shading.

If the problem persists after lighting changes, assign temporary contrasting debug materials to the fascia and gables. This distinguishes an actual overlap from a dark but valid underside.

## Blender node names lose dots in Three.js

### Symptom

The GLB contained names such as `cabin.wallFront`, but `scene.getObjectByName("cabin.wallFront")` could not find them.

### Cause

`GLTFLoader` sanitizes node names for animation-path compatibility. For example, `cabin.wallFront` becomes `cabinwallFront` at runtime. Morph-target dictionary names are not sanitized in the same way.

### Solution

Keep the original Blender names in the asset contract and pass node names through `THREE.PropertyBinding.sanitizeNodeName()` before runtime lookup. Continue using the exact exported Shape Key names when accessing `morphTargetDictionary`.

The asset-contract test parses the real production GLB and verifies every required node and morph target.

## Cabin height and width both affect roof height

### Symptom

The displayed 1800–2200 mm cabin-height range does not describe the measured overall height independently at every mixed width/height setting.

### Cause

Widening the gables raises their apex because the roof pitch is preserved. The exported width morph contributes approximately 288.7 mm of vertical roof growth, while the wall-height morph contributes approximately 111.3 mm. Together they account for the 400 mm difference between the all-minimum and all-maximum cabin envelopes.

The `cabin.boundingBox.min/max` nodes therefore describe the complete minimum and maximum configurations, not an independent roof-height range at every cabin width.

### Current behavior

The UI maps 1800–2200 mm linearly to the wall-height morph group, as selected for this prototype. Morph influences remain clamped to `0–1`; the application does not extrapolate Shape Keys to force an overall height that the asset was not authored to support.

### Future solution if exact independent dimensions are required

Author independent Blender Shape Keys or relational reference data so width can change without unintentionally changing the configured overall height. Do not solve this by applying morph influences outside `0–1`, because extrapolation can introduce gaps, intersections, and unsupported geometry states.

## Textures stretch when Shape Keys resize a mesh

### Symptom

Textures become wider or taller with the cabin, window, or structural meshes when a dimension slider changes. Enabling `THREE.RepeatWrapping` alone does not remove the distortion.

### Cause

Shape Keys change vertex positions but retain the mesh's exported UV coordinates. A UV interval that originally covered a 1 m surface therefore covers a larger deformed surface at maximum size, stretching the same part of the texture over more geometry.

`RepeatWrapping` is still working. It only controls how texture samples outside the `0–1` UV range wrap; it does not generate new UV coordinates or change their scale after a Shape Key deforms the mesh.

Planar projection and repeat wrapping are therefore complementary parts of one mapping strategy, not competing alternatives:

- Planar projection generates new, deformation-aware UV coordinates in physical model space.
- Repeat wrapping defines how the texture continues whenever those projected coordinates pass outside the first `0–1` tile.

Removing repeat wrapping was tested. Three.js then used clamped wrapping, causing UVs outside `0–1` to sample the nearest texture-edge pixels. On larger surfaces this produced smeared edges and broad flat bands instead of a continuous material. Normalizing every projected surface back into `0–1` would avoid clamping but would stretch the texture again, recreating the original Shape Key problem.

### Solution

The configurator recalculates planar UV coordinates from the current morphed vertex positions after dimensional changes. These generated coordinates are anchored to `cabin-origin`, which keeps the texture alignment stable as parts resize or move.

- Plywood uses explicit wall projection: front/back walls and gables use X/Y, while side walls use Z/Y.
- Other configurable material groups use a face-aligned planar basis derived from each morphed surface normal, including sloped roof surfaces.
- `RepeatWrapping` remains enabled and tiles each texture across the generated planar coordinates.
- Meshes outside the configurable material registry, such as fixed interior props, retain their Blender-authored UVs.

Texture scale is controlled in `src/materialController.js`:

- `PLYWOOD_TILE_SIZE_METERS` controls plywood tile size.
- `REPEATING_TILE_SIZE_METERS` controls the other projected materials.

Higher values make each tile cover more geometry and therefore produce fewer repeats.

### Validation

Compare minimum, maximum, and intermediate Shape Key values. Texture features should keep approximately the same physical scale instead of stretching with the mesh. Check seams and orientation on front, back, side, horizontal, and sloped faces.

## Re-export checklist

After replacing `public/3Dmesh/cabin_config.glb`:

1. Run `npm test` to validate required nodes, Shape Keys, reference objects, and expected bounds.
2. Run `npm run build` to verify the asset integration still bundles correctly.
3. Test minimum, maximum, and intermediate values for all four dimension controls.
4. Test combined cabin width/height and window width/height values, not only one slider at a time.
5. Check roof-to-gable attachment, side-wall positions, and window-opening clearance.
6. Treat any changed Blender node or Shape Key name as an application API change.
