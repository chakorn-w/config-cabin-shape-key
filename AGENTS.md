# AGENTS.md

## Project Goal

Build a lightweight web-based cabin configurator using **JavaScript, Three.js, and Vite**.

The cabin model is authored in **Blender** and exported for use in Three.js.

The configurator supports:

- Cabin width adjustment
- Cabin wall-height adjustment
- Window width adjustment
- Window height adjustment
- Window open/close animation
- Material/texture presentation
- Per-part color changes

Cabin depth is fixed and is **not configurable**.

---

## Core Architecture

### Blender owns geometry deformation

Use **Blender Shape Keys / glTF morph targets** as the primary system for changing cabin geometry.

The base model should represent the **minimum supported configuration**.

Shape Keys represent the deformation from minimum to maximum dimensions.

Typical deformation parameters:

- Cabin width
- Cabin wall height
- Window width
- Window height

Window dimensions are independent configurator parameters. The window opening and any deformable window-related geometry should use Shape Keys where appropriate, while rigid window parts should use relational transforms when they need to reposition rather than stretch.

Do not procedurally rebuild cabin geometry in Three.js unless there is a clear reason.

---

### Three.js owns configuration state

Three.js controls the current configurator state and maps user-selected dimensions to normalized Shape Key values.

Configuration values should have a clear minimum and maximum.

The application state is the source of truth.

Do not use current morph-target values as the source of truth for dimensions.

---

### Use transforms for relational movement

Not every component should deform.

Use object location/rotation when a component should keep its shape but move relative to the cabin dimensions.

Examples:

- Side walls moving outward as cabin width changes
- Corner frames following wall edges
- Gable or roof-related parts following wall height
- Fascia following roof position/orientation
- Window assemblies following their parent wall
- Window-frame or opening-related parts following window width/height changes

Prefer relational positioning based on cabin dimensions rather than arbitrary offsets.

---

## Modeling Rules

Keep the cabin modular.

Separate parts according to how they behave in the configurator.

Examples:

- Front wall
- Back wall
- Side walls
- Front/back gables
- Roof sections
- Corner frames
- Fascia
- Window assembly
- Other trims or structural parts

A component may use:

- Shape Key deformation
- Transform movement
- Both, when necessary

Do not combine unrelated parts into one mesh if they require different deformation or transform behavior.

---

## Shape Key Rules

- Basis represents the minimum configuration.
- Maximum Shape Keys represent the maximum supported dimension.
- Keep Shape Keys parameter-based rather than preset-size-based.
- Cabin width, cabin height, window width, and window height should remain independent controls where possible.
- Preserve topology across Shape Keys.
- Avoid operations that change vertex count after Shape Keys are created.
- Test combinations of width and height, not only each Shape Key independently.

---

## Coordinate and Origin Rules

Use a cabin root at the project origin.

Recommended convention:

- Cabin root at world `0,0,0`
- Root located at the center of the cabin footprint at floor level
- Individual object origins should match their useful structural pivot

Object origins do not need to share world origin.

Choose origins based on how the object needs to move or rotate.

---

## Technical Scope

Use only:

- JavaScript
- Three.js
- Vite

3D assets are created and exported from Blender.

Avoid introducing additional frameworks or architectural complexity unless required by the MVP.

---

## Implementation Principles

- Keep configuration logic separate from rendering logic.
- Keep each cabin subsystem independently understandable.
- Prefer small focused modules over one large configurator file.
- Use descriptive names related to cabin structure.
- Avoid single-letter variable names.
- Store dimensional constraints in one authoritative location.
- Keep Blender object and Shape Key names stable once connected to runtime logic.
- Treat GLB naming as part of the application API.
- Avoid hard-coded object-specific offsets when a relationship can be derived from cabin dimensions.
- Prioritize predictable deformation over clever procedural logic.

---

## Validation Priorities

Before adding visual polish, confirm:

1. Blender Shape Keys survive GLB export.
2. Three.js can discover and control the expected morph targets.
3. Cabin width interpolation works from minimum to maximum.
4. Cabin wall-height interpolation works from minimum to maximum.
5. Window width interpolation works from minimum to maximum.
6. Window height interpolation works from minimum to maximum.
7. Cabin and window dimensions work correctly in combination.
8. Relational components remain aligned across the full configurable range.
9. No visible gaps, overlaps, or distorted structural parts appear at intermediate values.

Do not move to later phases until the relevant geometry behavior is stable.
