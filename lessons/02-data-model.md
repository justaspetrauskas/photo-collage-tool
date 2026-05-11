# Lesson 2 — Data Model & Constants

> **Goal:** Understand the types that flow through the entire app and the physical constants that tie pixels to the real world.

---

## Why a dedicated `model/` layer?

All the domain knowledge lives in `src/features/collage/model/`. Nothing here imports React. This means:

- You can reason about the data without knowing anything about the UI.
- The same types are used by the layout engine, the renderer, the interactions, *and* the React components.
- Pure functions are trivial to test (no mocking, no DOM, no hooks).

---

## Physical constants

```ts
// src/features/collage/model/constants.ts
export const DPI = 300;            // print resolution
export const CM_PER_INCH = 2.54;
export const CANVAS_CM = 20;       // canvas is 20 × 20 cm
export const CANVAS_SIZE_PX = Math.round((CANVAS_CM / CM_PER_INCH) * DPI); // ≈ 2362 px
```

Everything in the canvas coordinate system is expressed in **pixels at 300 DPI**. The conversion helpers make it explicit:

```ts
export function cmToPx(cm: number): number {
  return (cm / CM_PER_INCH) * DPI;
}

export function mmToPx(mm: number): number {
  return cmToPx(mm / 10);
}
```

**Why 300 DPI?** Because that's the standard minimum resolution for high-quality photo printing. Every pixel decision is a physical decision.

---

## Core types

### `ImageItem` — one uploaded photo

```ts
export interface ImageItem {
  id: string;
  fileName: string;
  sourceBlob: Blob;          // original binary data
  originalSrc: string;       // object URL for the original
  src: string;               // object URL (may be AI-enhanced)
  bitmap: HTMLImageElement;  // loaded <img> element
  naturalWidth: number;
  naturalHeight: number;

  // layout constraints (set by the user via controls)
  maxWidthCm: number;
  maxHeightCm: number;

  // frame / border
  frameEnabled: boolean;
  frameThicknessPx: number;

  // render dimensions (computed by the layout engine)
  renderWidthPx: number;
  renderHeightPx: number;

  // crop offsets — how much the image is panned inside its frame
  offsetX: number;
  offsetY: number;
  cropMaxOffsetX: number;
  cropMaxOffsetY: number;
}
```

The key insight: an image is *larger* than its frame. `offsetX/offsetY` say where to start drawing it. This is the classic **cover-fit + pan** crop model.

```
┌────────────┐  ← frame (contentWidthPx × contentHeightPx)
│  [image]   │  ← drawn image is wider/taller (drawnImageWidthPx × drawnImageHeightPx)
│  ↑ offsetY │
│ ←offsetX   │
└────────────┘
```

### `PositionedImage` — an image placed on a page

```ts
export interface PositionedImage {
  imageId: string;
  x: number;           // top-left corner on the canvas (px)
  y: number;
  width: number;       // packed width including frame borders
  height: number;
  contentWidthPx: number;   // visible area (inside the frame)
  contentHeightPx: number;
  frameThicknessPx: number;
  drawnImageWidthPx: number; // how wide the bitmap is drawn (cover-fit)
  drawnImageHeightPx: number;
  maxOffsetX: number;
  maxOffsetY: number;
}
```

Notice: `PositionedImage` contains **no Blob, no bitmap, no fileName** — just geometry. The canvas renderer gets the pixel data by looking up the `ImageItem` by `imageId`.

### `PageLayout` — one printable page

```ts
export interface PageLayout {
  id: string;
  widthPx: number;
  heightPx: number;
  items: PositionedImage[];
}
```

The app supports multiple pages. `pages[0]` is shown first, and overflow images appear on subsequent pages.

### `BuildLayoutResult` — what the layout engine returns

```ts
export interface BuildLayoutResult {
  pages: PageLayout[];
  overflowImageIds: string[];   // images that didn't fit
  oversizedImageIds: string[];  // images that are too big even at minimum scale
  imageMetrics: Map<string, ImageMetrics>; // computed metrics per image
}
```

### `InteractionMode` — what the mouse is currently doing

```ts
export type InteractionMode = 'crop' | 'resize' | 'replace' | 'move';
```

Only one mode is active at a time. The mode determines what happens when the user clicks and drags on the canvas.

---

## Persistence types

The editor state is saved to IndexedDB so work survives a page refresh:

```ts
export interface PersistedEditorSnapshot {
  version: 1;
  savedAt: number;           // Unix timestamp
  settings: { ... };        // all the slider/toggle values
  pages: PageLayout[];
  overflowImageIds: string[];
  oversizedImageIds: string[];
  images: PersistedImageItem[];  // like ImageItem but without the in-memory bitmap
}
```

`PersistedImageItem` stores the raw `Blob` instead of the loaded `HTMLImageElement`. On load, the blobs are decoded back into `HTMLImageElement` objects.

---

## How types relate to each other

```
ImageItem[]  ──── layout engine ────►  BuildLayoutResult
                                            │
                                      PageLayout[]
                                            │
                                      PositionedImage[]
                                            │
                                    (renderer looks up ImageItem by imageId)
                                            │
                                      drawn on <canvas>
```

---

## Key insight: separation of concerns

| Type | Knows about |
|---|---|
| `ImageItem` | The photo (pixels, crop, size constraints) |
| `PositionedImage` | Where on the canvas, geometry only |
| `PageLayout` | The page (canvas size + list of positioned images) |

The layout engine's job is to **produce `PositionedImage` objects from `ImageItem` objects**. The renderer's job is to **draw them**. They talk only through these types.

---

## What's next?

In [Lesson 3](./03-layout-engine.md) we dig into the layout engine — how it uses a rectangle-packing algorithm to fit images onto pages automatically.
