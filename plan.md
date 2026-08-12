# plan.md

## MVP Goal

Create a working cabin configurator using a Blender-authored modular model.

The cabin must support:

- Adjustable cabin width
- Adjustable cabin wall height
- Adjustable window width
- Adjustable window height
- Fixed cabin depth

Shape Keys are the primary deformation system.

Object transforms may be used for components that must move relationally instead of deforming.

Tech stack:

- JavaScript
- Three.js
- Vite
- Blender-exported GLB

## Current Status

- **Phase 0 — Complete:** Shape Key dimensions and relational structural movement are integrated and validated.
- **Phase 1 — Complete:** The configurable window assembly and open/close animation are integrated and validated.
- **Phase 2 — Next:** Texture assets are being prepared before material and color-control implementation begins.

---

# Phase 0 — Shape Key Prototype (Complete)

## Goal

Prove that the Blender-to-Three.js Shape Key workflow is reliable before building the full configurator.

## Tasks

- Prepare the blockout cabin in Blender.
- Define minimum and maximum cabin width.
- Define minimum and maximum wall height.
- Define minimum and maximum window width.
- Define minimum and maximum window height.
- Use the minimum configuration as the Shape Key Basis.
- Create the required cabin-width Shape Keys.
- Create the required wall-height Shape Keys.
- Create the required window-width Shape Keys.
- Create the required window-height Shape Keys.
- Keep depth fixed.
- Export the model from Blender.
- Load the exported model in Three.js.
- Verify that expected morph targets are available.
- Connect cabin-width control to the relevant cabin-width morph targets.
- Connect cabin-height control to the relevant wall-height morph targets.
- Connect window-width control to the relevant window-width morph targets.
- Connect window-height control to the relevant window-height morph targets.
- Add relational object movement where Shape Keys are not appropriate.
- Verify side-wall and structural alignment as cabin width changes.
- Verify upper components follow wall-height changes correctly.

## Validation

Test at:

- Minimum cabin width / minimum cabin height
- Maximum cabin width / minimum cabin height
- Minimum cabin width / maximum cabin height
- Maximum cabin width / maximum cabin height
- Minimum window width / minimum window height
- Maximum window width / maximum window height
- Mixed cabin and window dimension combinations
- Several intermediate values across all configurable dimensions

Confirm:

- No geometry gaps
- No visible intersections
- No broken gable alignment
- Roof and fascia remain aligned
- Corner/structural pieces remain attached
- Window opening remains valid across the full window-size range
- Window-related geometry remains aligned with the wall
- Morph interpolation behaves correctly between endpoints

## Phase 0 Exit Condition

The cabin can change cabin width, wall height, window width, and window height throughout the full supported range without structural or visual failure.

## Completed Implementation

- Vite and Three.js viewer loads and validates the production GLB asset contract.
- Millimeter controls drive cabin width, cabin height, window width, and window height; cabin depth remains fixed.
- Shape Keys control deformable walls, gables, roof sheets, fascia, ground, wood framing, window opening, frame, and sashes.
- Parent relationships move rigid side-wall, corner-frame, wood-frame, roof, and ridge components without duplicate transforms.
- Blender reference objects define dimensional limits, fascia travel, and the window animation stop.
- Automated tests verify required nodes, Shape Keys, bounds, and parent relationships.

---

# Phase 1 — Window Interaction (Complete)

## Goal

Add the first interactive cabin component after the core configurator is stable.

## Tasks

- Update the GLB when the final window mesh is ready.
- Integrate the window assembly into the existing cabin hierarchy.
- Ensure the window follows cabin configuration correctly.
- Ensure open/close animation works across the full configurable window-size range.
- Add open/close animation.
- Keep window animation independent from cabin and window dimension controls.
- Verify the window remains correctly positioned through the full configurable range.

## Validation

Confirm:

- Window is visible and correctly aligned.
- Window remains attached to its intended wall.
- Open/close animation works at minimum configuration.
- Open/close animation works at maximum configuration.
- Animation still works at intermediate cabin and window dimensions.
- Cabin resizing does not corrupt the window animation state.
- Window resizing does not corrupt the open/close animation state.

## Phase 1 Exit Condition

The configurable cabin and animated window operate together without interfering with each other.

## Completed Implementation

- Window frame and both sashes resize with the independent window width and height controls.
- The left sash is parented to `windows-anim-check` and slides to the dynamic `windows-open-limit` reference.
- The animation stop follows window-width changes, including while the sash is open or moving.
- An accessible Open/Close switch controls a smooth, clamped animation while the right sash remains stationary.

---

# Phase 2 — Materials, Textures, and Color Controls (Next)

## Goal

Add visual presentation after geometry and interaction are stable.

## Texture Strategy

Start with the simplest reliable mapping method.

Preferred options:

- Planar projection
- Repeating/tiled textures

Choose based on the surface and the exported UV behavior.

Do not introduce more complex mapping unless the basic approach produces unacceptable stretching or alignment.

## Tasks

- Assign final material groups to cabin parts.
- Set up textures for the main surfaces.
- Use planar projection or texture repeat where appropriate.
- Verify textures remain visually consistent while width and height change.
- Add UI controls for changing colors.
- Allow relevant cabin parts to change color independently.
- Preserve texture detail while applying color changes where appropriate.
- Check that material changes do not create unnecessary duplicate materials.

## Validation

Confirm:

- Texture scale remains visually consistent across cabin sizes.
- Width deformation does not noticeably stretch textures.
- Height deformation does not noticeably stretch textures.
- Color controls affect only intended objects/material groups.
- Material switching does not break Shape Key deformation.
- Visual quality remains acceptable at minimum, maximum, and intermediate configurations.

## Phase 2 Exit Condition

The cabin supports configurable dimensions, animated window interaction, stable textures, and per-part color customization.

---

# Out of Scope for MVP

Do not add unless required later:

- Configurable cabin depth
- Procedural cabin generation
- Geometry Nodes runtime logic
- React or React Three Fiber
- TypeScript
- Physics
- WebXR / AR
- Advanced material systems
- Automatic roof-system generation
- Multiple cabin product variants

Maintain the stable Shape Key-driven geometry and window interaction while Phase 2 visual presentation is added.
