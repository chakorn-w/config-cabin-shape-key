# Cabin Configurator Math

This document explains how user-entered dimensions become Blender Shape Key influences, Three.js object transforms, window constraints, animation positions, and texture coordinates.

The central rule is:

> Blender defines the valid geometry and reference points; Three.js converts configuration state into normalized influences and relational transforms.

## 1. Units and notation

The user interface and configuration state use **millimetres**. Three.js and the exported GLB use **metres**.

```text
metres = millimetres / 1000
```

The formulas below use:

- `v`: current user-selected dimension
- `min`, `max`: limits measured from Blender reference meshes
- `t`: normalized Shape Key influence in the range `0–1`
- `P0`: an object's exported Basis position
- `P`: the object's configured position
- `clamp(x, a, b)`: restrict `x` to the inclusive range `a–b`

The current asset exposes these nominal limits:

| Dimension | Minimum | Maximum |
| --- | ---: | ---: |
| Cabin width | 1500 mm | 2500 mm |
| Cabin height | 1800 mm | 2200 mm |
| Window width | 900 mm | 1400 mm |
| Window height | 800 mm | 900 mm |
| Cabin depth | 1350 mm | Fixed |

The application measures these limits from the GLB bounding-box reference meshes rather than duplicating them as JavaScript constants.

## 2. Input clamping and normalization

Every configurable dimension is clamped before it is used:

```text
safeValue = finite(userValue) ? userValue : min
v = clamp(safeValue, min, max)
```

The clamped dimension is converted to a normalized Shape Key influence:

```text
t = (v - min) / (max - min)
```

This gives:

- `t = 0` at the Blender Basis/minimum shape
- `t = 1` at the Blender maximum Shape Key
- a linear interpolation between them

Example for a 2000 mm cabin width:

```text
tWidth = (2000 - 1500) / (2500 - 1500)
       = 0.5
```

The same normalized value is assigned to every morph target bound to that dimension. This keeps related parts synchronized while the application state remains the source of truth.

## 3. Shape Key deformation

The exported GLB uses relative morph targets. For a vertex with Basis position `pBasis`, morph delta `deltaP`, and influence `t`, the deformed local position is:

```text
pMorphed = pBasis + deltaP * t
```

When several independent Shape Keys affect a mesh, their deltas are added:

```text
pMorphed = pBasis + sum(deltaPi * ti)
```

Morph normals are combined the same way and normalized afterward:

```text
nMorphed = normalize(nBasis + sum(deltaNi * ti))
```

Three.js normally performs this deformation on the GPU for rendering. The material projection code repeats the calculation on the CPU so that UVs can be regenerated from the current deformed geometry.

## 4. Rigid side-wall movement

The side walls must keep their shape, so cabin width moves them instead of stretching them. The total width increase is split equally between the left and right sides:

```text
widthIncreaseM = (cabinWidthMm - cabinWidthMinMm) / 1000
halfIncreaseM = widthIncreaseM / 2

leftWallX  = leftWallBasisX  - halfIncreaseM
rightWallX = rightWallBasisX + halfIncreaseM
```

For a 2000 mm cabin:

```text
widthIncreaseM = (2000 - 1500) / 1000 = 0.5 m
halfIncreaseM = 0.25 m
```

Each wall therefore moves 0.25 m outward. Objects parented to a side wall inherit the same movement.

## 5. Height-following gables

`maximumHeightOffset` is read from the largest positive Y delta in the front-wall height morph. This ties rigid upper parts to the actual exported deformation instead of a guessed JavaScript distance.

```text
upperOffset = maximumHeightOffset * tCabinHeight

frontGableY = frontGableBasisY + upperOffset
backGableY  = backGableBasisY  + upperOffset
```

At the minimum cabin height the offset is zero. At the maximum cabin height it equals the full authored wall-height displacement.

## 6. Fascia and roof-height references

Cabin width raises the pitched roof as well as widening it, while cabin height raises the wall top. The fascia must include both contributions:

```text
fasciaY = roofHeightMinY
         + maximumWidthRoofOffset * tCabinWidth
         + maximumHeightOffset * tCabinHeight
```

`maximumWidthRoofOffset` is measured from the largest positive Y delta in the front-gable width morph. `maximumHeightOffset` comes from the wall-height morph.

The Blender empties provide an asset-level invariant:

```text
roofReferenceTravel = roofHeightMaxY - roofHeightMinY
expectedRoofTravel  = maximumWidthRoofOffset + maximumHeightOffset
```

The model is rejected when the difference exceeds 0.001 m:

```text
abs(roofReferenceTravel - expectedRoofTravel) <= 0.001 m
```

This is why the fascia reaches `roof-height-max` when both cabin dimensions are at maximum, while still remaining aligned at mixed width/height settings.

## 7. Dynamic window-height limit

The exported window range is 800–900 mm, but the full height is not safe at every cabin height. The `window-buffer` and `woodFrame-buffer` empties describe the available vertical clearance.

First, move the wood-frame buffer with the cabin height:

```text
tCabinHeight = normalize(cabinHeightMm, cabinHeightLimits)

woodBufferY = woodFrameBufferBasisY
              + maximumHeightOffset * tCabinHeight
```

Then convert the gap between the buffers into an allowed window-height influence:

```text
availableWindowT = clamp(
  (woodBufferY - windowBufferY) / maximumWindowHeightOffset,
  0,
  1
)
```

Finally, convert that influence back to millimetres:

```text
dynamicWindowMaxMm = floor(
  windowMinMm
  + availableWindowT * (windowMaxMm - windowMinMm)
)
```

The `floor` prevents rounding upward into an unsafe overlap. When cabin height is reduced, the application clamps the current window height to this new maximum before applying its Shape Keys.

## 8. Window opening distance

The window moves rigidly along X. Blender supplies the closed position through `windows-anim-check` and the open endpoint through `windows-open-limit`.

The opening grows symmetrically with window width, so the open-limit empty follows half of the added width:

```text
halfWindowIncreaseM = (windowWidthMm - windowWidthMinMm) / 1000 / 2

openLimitX = openLimitBasisX + halfWindowIncreaseM
travelX = openLimitX - animationRootBasisX
```

For normalized opening progress `pOpen`:

```text
windowRootX = animationRootBasisX + travelX * pOpen
```

This makes `pOpen = 0` closed and `pOpen = 1` exactly aligned with the Blender limit, including after window width changes.

## 9. Window animation timing

The open/close switch sets a target of either zero or one. Progress moves linearly over 0.65 seconds:

```text
direction = sign(target - pOpen)

pOpen = clamp(
  pOpen + direction * deltaSeconds / 0.65,
  0,
  1
)
```

If the remaining difference is below `0.001`, progress snaps to the target. The position is recalculated from the Basis position each frame, which avoids accumulated floating-point drift.

## 10. Planar texture projection after morphing

Static Blender UVs stretch when a Shape Key changes a surface's dimensions. The configurator therefore rebuilds UV coordinates from morphed vertex positions.

First, transform the deformed vertex from mesh-local space into world space relative to `cabin-origin`:

```text
pWorldRelative = meshMatrixWorld * pMorphed - cabinOriginWorld
```

### Plywood walls

Plywood uses axis-aligned planar projection with a 2 m tile size:

```text
front/back/gable: u = x / 2, v = y / 2
side walls:       u = z / 2, v = y / 2
```

Using the cabin origin keeps the texture phase consistent across separately moving wall meshes.

### Other repeating materials

Other materials use a face-aligned basis with a 1 m tile size. From the morphed world normal `n`:

```text
tangent   = normalize(worldUp cross n)
bitangent = normalize(n cross tangent)

u = dot(pWorldRelative, tangent) / 1
v = dot(pWorldRelative, bitangent) / 1
```

If the surface normal is nearly parallel to world-up, world-right is used to construct the tangent instead. The dot products project the vertex onto the surface-aligned axes, so roofs and angled parts keep a stable physical texture scale after morphing. Texture wrapping then repeats the maps outside the `0–1` UV interval.

## 11. Configuration update order

The calculations run in this order so dependent constraints use current state:

```text
1. Read and clamp the changed UI value.
2. If cabin height changed, calculate the dynamic window-height maximum.
3. Clamp the selected window height to that maximum.
4. Normalize all four configurable dimensions.
5. Apply Shape Key influences.
6. Apply rigid relational transforms.
7. Rebuild projected UVs from the morphed geometry.
8. During rendering, advance window animation using frame delta time.
```

This separation is important: dimensions remain in millimetres in application state, morphs use normalized `0–1` values, and rigid transforms use metres in the GLB coordinate system.

## 12. Minimal pseudocode

```text
onUserInput(key, rawValue):
  configuration[key] = clamp(rawValue, limits[key].min, limits[key].max)

  if key is cabinHeight:
    safeWindowMax = calculateWindowMaximum(configuration.cabinHeight)
    configuration.windowHeight = min(configuration.windowHeight, safeWindowMax)

  for each configurable dimension:
    influence[dimension] = normalize(configuration[dimension], limits[dimension])
    apply influence to every bound Blender morph target

  move side walls by half the cabin-width increase
  move gables by the exported wall-height morph offset
  position fascia from the combined width and height roof offsets
  move the window-open limit by half the window-width increase
  position the window from its current open progress
  rebuild texture UVs from morphed positions and normals
```

## Related implementation

- `src/configuration.js`: input clamping and normalization
- `src/cabinModel.js`: morph bindings, relational transforms, window constraint, and animation
- `src/materialController.js`: morphed vertex evaluation and planar UV projection
- `debug-docs.md`: symptoms, causes, and solutions for geometry and rendering issues found during development
