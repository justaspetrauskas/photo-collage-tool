# Lesson 3 — Layout Engine

> **Goal:** Understand how the app turns a list of uploaded images into a packed, print-ready page layout — automatically.

---

## The problem

You have `N` photos of varying sizes. You want them all to fit on a fixed canvas (20 × 20 cm at 300 DPI ≈ 2362 × 2362 px) without overlapping, and you want to fill the space as efficiently as possible. If they don't all fit on one page, overflow goes to a second page, and so on.

This is the **2D bin-packing problem**, and it's NP-hard in the general case. We use a well-known heuristic: **MaxRects**.

---

## The rectangle packer

```ts
import { MaxRectsBin } from 'maxrects-packer';
```

`maxrects-packer` implements the MaxRects algorithm. You give it a bin size and a list of rectangles; it returns placements with `(x, y)` coordinates. It finds tight packings fast enough for interactive use.

Basic usage:
```ts
const bin = new MaxRectsBin(canvasWidthPx, canvasHeightPx, 0 /* padding */);
bin.add(rectWidth, rectHeight, { id: 'img-1' });
// bin.rects now contains placed rectangles with .x, .y, .width, .height, .data
```

---

## The main entry point

```ts
// src/features/collage/model/layoutEngine.ts
export function buildPaginatedLayout(
  images: ImageItem[],
  options: LayoutOptions,
): BuildLayoutResult
```

This is the only function the rest of the app calls for layout. Everything else in the file is private.

---

## Step-by-step walkthrough

### Step 1 — Compute base sizes

Each `ImageItem` carries `maxWidthCm` and `maxHeightCm`. The first step scales each image to fit inside that box while preserving aspect ratio:

```ts
function getContentBox(naturalWidth, naturalHeight, maxWidthCm, maxHeightCm) {
  const maxWidthPx = cmToPx(maxWidthCm);
  const maxHeightPx = cmToPx(maxHeightCm);
  const fitScale = Math.min(maxWidthPx / naturalWidth, maxHeightPx / naturalHeight);
  return { widthPx: Math.round(naturalWidth * fitScale),
           heightPx: Math.round(naturalHeight * fitScale) };
}
```

The result is stored as `baseContentWidthPx / baseContentHeightPx`. Frame borders are added on top:

```
packedWidth  = contentWidthPx  + frameThicknessPx * 2
packedHeight = contentHeightPx + frameThicknessPx * 2
```

Images are sorted **largest first** before packing — the MaxRects heuristic performs better this way.

### Step 2 — Scale search

The target canvas is fixed. If the images at their base size don't all fit, the algorithm tries shrinking them uniformly in 5 % steps until everything fits (or the minimum scale of 35 % is reached):

```ts
for (let scale = 1; scale >= 0.35; scale -= 0.05) {
  const projected = projectRects(remaining, scale);
  const bin = new MaxRectsBin(canvasWidthPx, canvasHeightPx, 0);
  projected.forEach(rect => bin.add(rect.packedWidth, rect.packedHeight, { id: rect.id }));

  if (bin.rects.length === projected.length) break; // all fit — done!
}
```

The best scale is the one that **places the most images** (and, as a tiebreaker, covers the most area).

### Step 3 — Pagination

Whatever didn't fit on the current page becomes the `remaining` list for the next iteration. The loop keeps creating pages until either all images are placed or the `maxPages` limit is reached:

```ts
while (remaining.length > 0 && pages.length < maxPages) {
  // run scale search → build a page
  // remaining = images that didn't fit
}
```

### Step 4 — Compaction

After initial packing, a greedy **compaction** pass tries to pull images from later pages onto earlier ones:

```ts
function compactPages(pages) {
  // For each page, try to absorb items from later pages
  // Accept only if re-packing still fits
}
```

This reduces wasted space — images that couldn't fit on page 1 at full scale might fit after page 1 has been repacked at a tighter scale.

### Step 5 — Overlap safety net

A final `enforceNoOverlap` pass re-packs each page through MaxRects to eliminate any edge-case overlaps that the compaction step might have introduced.

---

## Crop metrics

The layout engine also computes how the *bitmap* should be drawn inside the *frame*:

```ts
function getCropMetrics(naturalWidth, naturalHeight, frameWidth, frameHeight) {
  // "cover" scale: zoom the image until it fills the entire frame
  const coverScale = Math.max(frameWidth / naturalWidth, frameHeight / naturalHeight);
  const drawnImageWidthPx  = Math.round(naturalWidth  * coverScale);
  const drawnImageHeightPx = Math.round(naturalHeight * coverScale);
  return {
    drawnImageWidthPx,
    drawnImageHeightPx,
    maxOffsetX: Math.max(0, drawnImageWidthPx - frameWidth),  // pan budget
    maxOffsetY: Math.max(0, drawnImageHeightPx - frameHeight),
  };
}
```

This is a **cover fit** — the image is always fully visible with no letterboxing, but part of it may be cropped. The user later pans via the crop interaction.

---

## Helper: `clampOffsets`

```ts
export function clampOffsets(offsetX, offsetY, maxOffsetX, maxOffsetY) {
  return {
    offsetX: clamp(offsetX, 0, maxOffsetX),
    offsetY: clamp(offsetY, 0, maxOffsetY),
  };
}
```

Called whenever a crop offset is updated to prevent the image from sliding outside the frame.

---

## Shared math utilities

The geometry functions used by the layout engine are extracted to `src/shared/math/` so other layers can reuse them without importing the layout engine:

```ts
// src/shared/math/geometry.ts
export function rectanglesOverlap(a, b): boolean { ... }
export function isInsideCanvas(rect, canvasSize): boolean { ... }
export function hasAnyOverlaps(rectangles): boolean { ... }
export function clampCropOffset(offsetX, offsetY, maxOffsetX, maxOffsetY) { ... }

// src/shared/math/sizing.ts
export function computeContentBox(naturalWidth, naturalHeight, maxWidthCm, maxHeightCm) { ... }
export function computeCropMetrics(naturalWidth, naturalHeight, frameWidth, frameHeight) { ... }
```

**Rule:** The layout engine uses these for its internal passes. The interaction modules use them when computing drag deltas. The renderer uses them for hit-testing.

---

## Data flow summary

```
ImageItem[]
     │
     ▼
buildPaginatedLayout()
  │  ├── getContentBox()         → base sizes
  │  ├── projectRects(scale)     → scaled + framed rects
  │  ├── MaxRectsBin.add()       → placement x,y
  │  ├── compactPages()          → tighter packing
  │  └── enforceNoOverlap()      → safety re-pack
     │
     ▼
BuildLayoutResult
  ├── pages: PageLayout[]        → PositionedImage[] with x,y,width,height
  ├── overflowImageIds           → didn't fit anywhere
  ├── oversizedImageIds          → too big even at 35% scale
  └── imageMetrics               → per-image sizing info
```

---

## What's next?

In [Lesson 4](./04-interaction-system.md) we look at how the user *interacts* with the canvas — the four drag modes (crop, move, resize, replace) and the unified drag-state architecture.
